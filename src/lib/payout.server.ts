// Automatic $DOGG payouts from the payout hot wallet (server only).
// Flow per run (under one DB lock, so wallet seqnos never collide):
//  1. Reconcile 'sending' rows against the chain: confirmed → 'sent'; bounced → refund; expired unsent → back to 'pending'.
//  2. Send 'pending' rows one at a time, each only after the previous message has been executed.
// Unconfirmed sends whose seqno was used stay 'sending' for manual review (never auto-refunded: that could double-pay).
import { Address, beginCell, Cell, external, internal, SendMode, storeMessage, toNano, WalletContractV4, WalletContractV5R1 } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { JETTON } from './dogg';
import { jettonUnits, matchTransfer, queryIdFor, type ChainTransfer } from './payout-match';

type Admin = SupabaseClient<Database>;
type Ctx = Awaited<ReturnType<typeof setup>>;
type Row = { id: string; address: string; amount: number; seqno: number | null; query_id: string | null; attempted_at: string | null };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const MSG_VALUE = toNano('0.06');      // attached to the jetton transfer; the unused part comes back as excess
const MIN_TON = toNano('0.08');        // don't send unless the wallet can pay the fees
const EXPIRE_MS = 3 * 60_000;          // a signed message is valid 60 s; after 3 min an unexecuted one can never land
const REVIEW_MS = 15 * 60_000;

async function retry<T>(fn: () => Promise<T>, tries = 4): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) { try { return await fn(); } catch (e) { last = e; await sleep(1100 * (i + 1)); } }
  throw last;
}

/** Minimal fetch-based toncenter v2 client (no axios, so it runs on the edge runtime). */
function toncenter(apiKey: string | undefined) {
  const rpc = <T>(method: string, params: Record<string, unknown>) => retry(async () => {
    const r = await fetch('https://toncenter.com/api/v2/jsonRPC', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(apiKey ? { 'X-API-Key': apiKey } : {}) }, body: JSON.stringify({ id: 1, jsonrpc: '2.0', method, params }) });
    const j = await r.json().catch(() => null) as { ok?: boolean; result?: T; error?: string } | null;
    if (!r.ok || !j?.ok) throw new Error(`toncenter ${method} ${r.status}: ${j?.error ?? ''}`);
    return j.result as T;
  });
  type Stack = [string, unknown][];
  const runGet = async (address: Address, method: string, stack: Stack = []) => {
    const res = await rpc<{ exit_code: number; stack: Stack }>('runGetMethod', { address: address.toString(), method, stack });
    if (res.exit_code !== 0 && res.exit_code !== 1) throw new Error(`${method} exit ${res.exit_code}`);
    return res.stack;
  };
  const num = (item: [string, unknown] | undefined) => BigInt(String(item?.[1] ?? '0'));
  const cell = (item: [string, unknown] | undefined) => Cell.fromBase64((item?.[1] as { bytes: string }).bytes);
  return {
    state: (a: Address) => rpc<{ balance: string; state: string }>('getAddressInformation', { address: a.toString() }).then(r => ({ balance: BigInt(r.balance), state: r.state })),
    seqno: async (a: Address) => { try { return Number(num((await runGet(a, 'seqno'))[0])); } catch { return 0; } },
    jettonWallet: async (owner: Address) => cell((await runGet(Address.parse(JETTON), 'get_wallet_address', [['tvm.Slice', beginCell().storeAddress(owner).endCell().toBoc().toString('base64')]]))[0]).beginParse().loadAddress(),
    jettonBalance: async (jw: Address) => { try { return num((await runGet(jw, 'get_wallet_data'))[0]); } catch { return 0n; } },
    sendBoc: (boc: string) => rpc('sendBoc', { boc }),
  };
}

async function setup() {
  const words = process.env['PAYOUT_MNEMONIC']?.trim().split(/\s+/);
  if (!words || words.length < 12) throw new Error('Wallet de pagos no configurada');
  const key = await mnemonicToPrivateKey(words);
  const apiKey = process.env['TONCENTER_API_KEY'];
  const tc = toncenter(apiKey);
  const v5 = WalletContractV5R1.create({ workchain: 0, publicKey: key.publicKey });
  const v4 = WalletContractV4.create({ workchain: 0, publicKey: key.publicKey });
  // Use the deployed wallet version that holds the funds (Tonkeeper creates W5 by default, older wallets are v4).
  const s5 = await tc.state(v5.address); const s4 = await tc.state(v4.address);
  const wallet = s5.state === 'active' && (s4.state !== 'active' || s5.balance >= s4.balance) ? v5 : v4;
  const jettonWallet = await tc.jettonWallet(wallet.address);
  const decimals = 9; // $DOGG metadata: 9 decimals
  return { tc, wallet, key, jettonWallet, decimals, apiKey, seqno: () => tc.seqno(wallet.address) };
}

async function funds(ctx: Ctx) {
  const ton = (await ctx.tc.state(ctx.wallet.address)).balance;
  const dogg = await ctx.tc.jettonBalance(ctx.jettonWallet);
  return { ton, dogg };
}

/** Recent $DOGG transfers out of the payout wallet: toncenter (with query_id), TONAPI as backup. */
async function outgoing(ctx: Ctx, sinceSec: number): Promise<ChainTransfer[]> {
  const owner = ctx.wallet.address.toRawString();
  try {
    const url = `https://toncenter.com/api/v3/jetton/transfers?owner_address=${owner}&jetton_master=${JETTON}&direction=out&start_utime=${Math.max(0, sinceSec)}&limit=100&sort=desc`;
    const r = await fetch(url, ctx.apiKey ? { headers: { 'X-API-Key': ctx.apiKey } } : undefined);
    if (r.ok) {
      const j = await r.json() as { jetton_transfers?: { query_id?: string; destination: string; amount: string; transaction_aborted: boolean; transaction_hash: string; transaction_now: number }[] };
      if (j.jetton_transfers) return j.jetton_transfers.map(t => ({ queryId: t.query_id ?? null, destination: t.destination, amount: t.amount, aborted: t.transaction_aborted, hash: t.transaction_hash, at: t.transaction_now }));
    }
  } catch { /* backup below */ }
  const r = await fetch(`https://tonapi.io/v2/accounts/${owner}/jettons/${JETTON}/history?limit=100`);
  if (!r.ok) throw new Error(`indexers unavailable (${r.status})`);
  const j = await r.json() as { events?: { event_id: string; timestamp: number; actions: { type: string; status: string; JettonTransfer?: { sender?: { address: string }; recipient?: { address: string }; amount: string } }[] }[] };
  const out: ChainTransfer[] = [];
  for (const e of j.events ?? []) for (const a of e.actions) {
    const t = a.JettonTransfer;
    if (a.type === 'JettonTransfer' && t && t.sender?.address.toLowerCase() === owner.toLowerCase() && t.recipient) out.push({ queryId: null, destination: t.recipient.address, amount: t.amount, aborted: a.status !== 'ok', hash: e.event_id, at: e.timestamp });
  }
  return out;
}

async function markSent(admin: Admin, id: string, hash: string) {
  await admin.from('dogg_withdrawals').update({ status: 'sent', sent_at: new Date().toISOString(), tx_hash: hash, error: null }).eq('id', id).eq('status', 'sending');
  await notifyWithdrawal(admin, id);
}

async function refund(admin: Admin, id: string) {
  await admin.rpc('dogg_withdraw_fail', { p_id: id, p_error: 'La transferencia fue rechazada en la blockchain; saldo devuelto.' });
  await notifyWithdrawal(admin, id);
}

/** Resolves one 'sending' row. Returns true when it may still land (so nothing new may be sent yet). */
async function reconcile(ctx: Ctx, admin: Admin, w: Row, seqnoNow: number, list: ChainTransfer[]) {
  const attempted = w.attempted_at ? Date.parse(w.attempted_at) : 0;
  const m = matchTransfer(list, { queryId: w.query_id ?? queryIdFor(w.id), destination: Address.parse(w.address).toRawString(), units: jettonUnits(Number(w.amount), ctx.decimals), after: Math.floor(attempted / 1000) });
  if (m && !m.aborted) { await markSent(admin, w.id, m.hash); return false; }
  if (m && m.aborted) { await admin.rpc('dogg_withdraw_fail', { p_id: w.id, p_error: 'La transferencia fue rechazada en la blockchain; saldo devuelto.' }); return false; }
  const age = Date.now() - attempted;
  if (w.seqno == null || seqnoNow <= w.seqno) {
    // Our message was never executed. Once it has expired it can't land anymore: safe to send again.
    if (age > EXPIRE_MS) { await admin.from('dogg_withdrawals').update({ status: 'pending', error: 'Reintentando envío' }).eq('id', w.id).eq('status', 'sending'); return false; }
    return true;
  }
  if (age > REVIEW_MS) await admin.from('dogg_withdrawals').update({ error: 'Sin confirmar en la blockchain: revisar manualmente' }).eq('id', w.id).eq('status', 'sending');
  return false;
}

async function sendOne(ctx: Ctx, w: Row, seqno: number, queryId: string) {
  const units = jettonUnits(Number(w.amount), ctx.decimals);
  const body = beginCell().storeUint(0xf8a7ea5, 32).storeUint(BigInt(queryId), 64).storeCoins(units)
    .storeAddress(Address.parse(w.address)).storeAddress(ctx.wallet.address).storeBit(0).storeCoins(1n).storeBit(0).endCell();
  const args = { seqno, secretKey: ctx.key.secretKey, sendMode: SendMode.PAY_GAS_SEPARATELY | SendMode.IGNORE_ERRORS, messages: [internal({ to: ctx.jettonWallet, value: MSG_VALUE, bounce: true, body })] };
  const transfer: Cell = ctx.wallet instanceof WalletContractV5R1 ? ctx.wallet.createTransfer(args) : ctx.wallet.createTransfer(args);
  const ext = external({ to: ctx.wallet.address, body: transfer });
  await ctx.tc.sendBoc(beginCell().store(storeMessage(ext)).endCell().toBoc().toString('base64'));
}

/** Pays queued withdrawals automatically. Safe to call often (from requests and the scheduled job). */
export async function processPayouts(admin: Admin, budgetMs = 45_000) {
  const started = Date.now();
  const summary = { sent: 0, reconciled: 0, waiting: false, error: null as string | null };
  let got = false;
  for (let i = 0; i < 4 && !got; i++) { got = Boolean((await admin.rpc('dogg_payout_acquire')).data); if (!got) await sleep(2500); }
  if (!got) return { ...summary, error: 'busy' };
  try {
    const ctx = await setup();
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { data: sending } = await admin.from('dogg_withdrawals').select('id, address, amount, seqno, query_id, attempted_at').eq('status', 'sending').gte('created_at', since);
    if (sending?.length) {
      const seqnoNow = await ctx.seqno();
      const oldest = Math.min(...sending.map(w => (w.attempted_at ? Date.parse(w.attempted_at) : Date.now()) / 1000));
      const list = await outgoing(ctx, Math.floor(oldest) - 300).catch(() => null);
      if (!list) { summary.waiting = true; return summary; }
      for (const w of sending) { if (await reconcile(ctx, admin, w as Row, seqnoNow, list)) summary.waiting = true; else summary.reconciled++; }
      if (summary.waiting) return summary;
    }
    while (Date.now() - started < budgetMs) {
      const { data: next } = await admin.from('dogg_withdrawals').select('id, address, amount, seqno, query_id, attempted_at').eq('status', 'pending').order('created_at').limit(1).maybeSingle();
      if (!next) break;
      const w = next as Row;
      const f = await funds(ctx);
      if (f.ton < MIN_TON || f.dogg < jettonUnits(Number(w.amount), ctx.decimals)) {
        // Keep it queued (no refund): it goes out automatically once the payout wallet is topped up.
        await admin.from('dogg_withdrawals').update({ error: f.ton < MIN_TON ? 'Wallet de pagos sin TON para comisiones' : 'Wallet de pagos sin $DOGG suficientes' }).eq('id', w.id);
        summary.error = 'payout wallet needs funds';
        break;
      }
      const seqno = await ctx.seqno();
      const queryId = queryIdFor(w.id);
      // Record the attempt BEFORE sending: if anything breaks after the send, reconcile still knows about it.
      const claimed = await admin.from('dogg_withdrawals').update({ status: 'sending', seqno, query_id: queryId, attempted_at: new Date().toISOString(), error: null }).eq('id', w.id).eq('status', 'pending').select('id');
      if (!claimed.data?.length) continue;
      try { await sendOne(ctx, w, seqno, queryId); } catch (e) { console.error('payout send', e); }
      let executed = false;
      for (let t = 0; t < 16 && !executed; t++) { await sleep(2500); executed = (await ctx.seqno()) > seqno; }
      if (!executed) { summary.waiting = true; break; } // resolved by a later run
      for (let t = 0; t < 6; t++) {
        await sleep(3000);
        const list = await outgoing(ctx, Math.floor(Date.now() / 1000) - 600).catch(() => []);
        const m = matchTransfer(list, { queryId, destination: Address.parse(w.address).toRawString(), units: jettonUnits(Number(w.amount), ctx.decimals), after: Math.floor(Date.now() / 1000) - 600 });
        if (m && !m.aborted) { await markSent(admin, w.id, m.hash); summary.sent++; break; }
        if (m && m.aborted) { await admin.rpc('dogg_withdraw_fail', { p_id: w.id, p_error: 'La transferencia fue rechazada en la blockchain; saldo devuelto.' }); break; }
      }
    }
  } catch (e) {
    console.error('payout run', e);
    summary.error = e instanceof Error ? e.message : String(e);
  } finally { await admin.rpc('dogg_payout_release'); }
  return summary;
}

/** Read-only snapshot of the payout wallet (address, version, balances) for diagnostics. */
export async function payoutStatus() {
  const ctx = await setup();
  const f = await funds(ctx);
  const recent = await outgoing(ctx, Math.floor(Date.now() / 1000) - 30 * 86400).catch(() => null);
  return { address: ctx.wallet.address.toString({ bounceable: false }), version: ctx.wallet instanceof WalletContractV5R1 ? 'W5' : 'v4', ton: Number(f.ton) / 1e9, dogg: Number(f.dogg) / 10 ** ctx.decimals, jettonWallet: ctx.jettonWallet.toString(), seqno: await ctx.seqno(), indexerOk: recent !== null, recentOut: recent?.length ?? 0 };
}
