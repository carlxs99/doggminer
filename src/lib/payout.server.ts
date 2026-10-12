// Automatic $DOGG payouts from the payout hot wallet (server only).
import { Address, beginCell, internal, SendMode, toNano, TonClient, WalletContractV4, WalletContractV5R1 } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { JETTON } from './dogg';

type Admin = SupabaseClient<Database>;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function setup() {
  const words = process.env['PAYOUT_MNEMONIC']?.trim().split(/\s+/);
  if (!words || words.length < 12) throw new Error('Wallet de pagos no configurada');
  const key = await mnemonicToPrivateKey(words);
  const apiKey = process.env['TONCENTER_API_KEY'];
  const client = new TonClient({ endpoint: 'https://toncenter.com/api/v2/jsonRPC', ...(apiKey ? { apiKey } : {}) });
  const v5 = WalletContractV5R1.create({ workchain: 0, publicKey: key.publicKey });
  const v4 = WalletContractV4.create({ workchain: 0, publicKey: key.publicKey });
  // Use whichever wallet version is actually deployed (Tonkeeper creates W5 by default).
  const s5 = await client.getContractState(v5.address);
  const wallet = s5.state === 'active' ? v5 : v4;
  const opened = client.open(wallet);
  const jw = await client.runMethod(Address.parse(JETTON), 'get_wallet_address', [{ type: 'slice', cell: beginCell().storeAddress(wallet.address).endCell() }]);
  const jettonWallet = jw.stack.readAddress();
  const meta = await fetch(`https://tonapi.io/v2/jettons/${JETTON}`).then(r => r.ok ? r.json() as Promise<{ metadata?: { decimals?: string } }> : null).catch(() => null);
  const decimals = Number(meta?.metadata?.decimals ?? 9);
  return { client, opened, wallet, key, jettonWallet, decimals };
}

async function sendOne(ctx: Awaited<ReturnType<typeof setup>>, to: string, amount: number) {
  const units = BigInt(Math.round(amount * 10 ** Math.min(ctx.decimals, 6))) * 10n ** BigInt(Math.max(ctx.decimals - 6, 0));
  const body = beginCell().storeUint(0xf8a7ea5, 32).storeUint(BigInt(Date.now()), 64).storeCoins(units)
    .storeAddress(Address.parse(to)).storeAddress(ctx.wallet.address).storeBit(0).storeCoins(1n).storeBit(0).endCell();
  const seqno = await ctx.opened.getSeqno();
  await ctx.opened.sendTransfer({ seqno, secretKey: ctx.key.secretKey, sendMode: SendMode.PAY_GAS_SEPARATELY | SendMode.IGNORE_ERRORS, messages: [internal({ to: ctx.jettonWallet, value: toNano('0.05'), bounce: true, body })] });
  return seqno;
}

/** Sends queued withdrawals one by one under a global lock so wallet seqnos never collide. */
export async function processPayouts(admin: Admin) {
  let got = false;
  for (let i = 0; i < 4 && !got; i++) { got = Boolean((await admin.rpc('dogg_payout_acquire')).data); if (!got) await sleep(2500); }
  if (!got) return;
  try {
    const { data: queue } = await admin.from('dogg_withdrawals').select('id, address, amount').eq('status', 'pending').order('created_at').limit(3);
    if (!queue?.length) return;
    let ctx: Awaited<ReturnType<typeof setup>>;
    try { ctx = await setup(); } catch (e) { console.error('payout setup', e); return; }
    for (const w of queue) {
      let seqno: number;
      try { seqno = await sendOne(ctx, w.address, Number(w.amount)); }
      catch (e) { console.error('payout send', e); await admin.rpc('dogg_withdraw_fail', { p_id: w.id, p_error: e instanceof Error ? e.message : String(e) }); continue; }
      await admin.from('dogg_withdrawals').update({ status: 'sending', seqno }).eq('id', w.id);
      let confirmed = false;
      for (let t = 0; t < 12 && !confirmed; t++) { await sleep(2500); try { confirmed = (await ctx.opened.getSeqno()) > seqno; } catch { /* retry */ } }
      if (confirmed) await admin.from('dogg_withdrawals').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', w.id);
    }
  } finally { await admin.rpc('dogg_payout_release'); }
}
