import { Cell, loadTransaction } from '@ton/core';
import { paymentMatches, type VerificationTransfer } from './purchase';
type Admin = (typeof import('@/integrations/supabase/client.server'))['supabaseAdmin'];

/** Parse the receiving account's canonical transaction BOC, not a client receipt. */
export function parseVerificationTransfer(data: string): VerificationTransfer | null {
  try {
    const cell = Cell.fromBase64(data);
    const tx = loadTransaction(cell.beginParse());
    const msg = tx.inMessage;
    if (!msg || msg.info.type !== 'internal' || tx.description.type !== 'generic') return null;
    const body = msg.body.beginParse();
    if (body.remainingBits < 32 || body.loadUint(32) !== 0) return null;
    const memo = body.loadStringTail();
    if (!/^DOGG-VERIFY-[0-9a-f-]{36}$/.test(memo)) return null;
    return { memo, sender: msg.info.src.toRawString(), recipient: msg.info.dest.toRawString(), amount: msg.info.value.coins, hash: cell.hash().toString('hex'), at: tx.now, aborted: tx.description.aborted, bounced: msg.info.bounced || tx.description.bouncePhase?.type === 'ok' };
  } catch { return null; }
}

type ChainTx = { data: string; utime: number; transaction_id: { lt: string; hash: string } };
async function transactions(recipient: string, lt?: string, hash?: string): Promise<ChainTx[]> {
  const url = new URL('https://toncenter.com/api/v2/getTransactions');
  url.searchParams.set('address', recipient); url.searchParams.set('limit', '100'); url.searchParams.set('archival', 'true');
  if (lt && hash) { url.searchParams.set('lt', lt); url.searchParams.set('hash', hash); }
  const key = process.env['TONCENTER_API_KEY'];
  const r = await fetch(url, { headers: key ? { 'X-API-Key': key } : {}, signal: AbortSignal.timeout(8000) });
  const j = await r.json() as { ok?: boolean; result?: ChainTx[] };
  if (!r.ok || !j.ok || !Array.isArray(j.result)) throw new Error('No se pudo comprobar tu wallet ahora mismo.');
  return j.result;
}

async function confirm(admin: Admin, t: VerificationTransfer) {
  const { data: p, error } = await admin.from('dogg_verification_payments').select('memo,wallet_address,recipient,created_at').eq('memo', t.memo).maybeSingle();
  if (error) throw error;
  if (!p || !paymentMatches(t, { memo: p.memo, wallet: p.wallet_address, recipient: p.recipient, createdAt: Date.parse(p.created_at) })) return;
  const r = await admin.rpc('dogg_confirm_verification', { p_memo: t.memo, p_sender: t.sender, p_recipient: t.recipient, p_amount: Number(t.amount), p_hash: t.hash, p_utime: t.at });
  if (r.error) throw r.error;
}

/** Fast foreground read; the durable background scan covers busy accounts and closed apps. */
export async function checkVerification(admin: Admin, recipient: string) {
  for (const tx of await transactions(recipient)) { const t = parseVerificationTransfer(tx.data); if (t) await confirm(admin, t); }
}

/** Two pages per run, with a persisted continuation. Never skip a busy interval. */
export async function reconcileVerifications(admin: Admin) {
  const pending = await admin.from('dogg_verification_payments').select('recipient,created_at').is('confirmed_at', null).order('created_at').limit(1);
  if (pending.error) throw pending.error;
  const p = pending.data?.[0]; if (!p) return;
  const read = await admin.from('dogg_verification_cursor').select('*').eq('recipient', p.recipient).maybeSingle();
  if (read.error) throw read.error;
  const c = read.data;
  let pageLt = c?.page_lt ?? undefined, pageHash = c?.page_hash ?? undefined;
  let head = c?.head_lt ?? '0';
  const frontier = BigInt(c?.last_lt ?? '0');
  for (let page = 0; page < 2; page++) {
    const rows = await transactions(p.recipient, pageLt, pageHash);
    if (!pageLt) head = rows[0]?.transaction_id.lt ?? c?.last_lt ?? '0';
    let done = rows.length < 100;
    for (const tx of rows) {
      if (BigInt(tx.transaction_id.lt) <= frontier || tx.utime * 1000 < Date.parse(p.created_at)) { done = true; break; }
      const t = parseVerificationTransfer(tx.data); if (t) await confirm(admin, t);
    }
    const last = rows[rows.length - 1];
    if (done || !last) {
      const r = await admin.from('dogg_verification_cursor').upsert({ recipient: p.recipient, last_lt: head, head_lt: null, page_lt: null, page_hash: null });
      if (r.error) throw r.error; return;
    }
    pageLt = last.transaction_id.lt; pageHash = last.transaction_id.hash;
    const r = await admin.from('dogg_verification_cursor').upsert({ recipient: p.recipient, last_lt: frontier.toString(), head_lt: head, page_lt: pageLt, page_hash: pageHash });
    if (r.error) throw r.error;
  }
}