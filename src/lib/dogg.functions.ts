import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { JETTON } from './dogg';
import { autoUpgradeId } from './mining';

const PlayerSchema = z.object({ balance: z.number(), shiftStartedAt: z.string().nullable(), claimedShifts: z.number(), streak: z.number(), lastCheckin: z.string().nullable(), minerId: z.string(), shiftAccrued: z.number(), rateChangedAt: z.string().nullable(), walletAddress: z.string().nullable().optional(), hold: z.number().optional(), downgraded: z.string().nullable().optional(), withdrawVerified: z.boolean().optional(), shiftBoost: z.number().optional(), turboAt: z.string().nullable().optional(), turboDay: z.string().nullable().optional(), lpActive: z.boolean().optional(), lpTon: z.number().nullable().optional() });

async function verifyTelegramUser(initData: string) { return (await import('./telegram.server')).verifyTelegramUser(initData); }
async function verifyTelegram(initData: string) { return (await verifyTelegramUser(initData)).id; }

/** Real on-chain $DOGG balance (whole tokens) of a raw/friendly address, read server-side from TONAPI. */
async function jettonHold(address: string) {
  const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
  const key = process.env['TONAPI_KEY'];
  let lastStatus = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`https://tonapi.io/v2/accounts/${encodeURIComponent(address)}/jettons/${JETTON}`, key ? { headers: { Authorization: `Bearer ${key}` } } : undefined);
    if (res.status === 404) return 0;
    if (res.ok) {
      const j = await res.json() as { balance?: string; jetton?: { decimals?: number } };
      return Number(j.balance ?? '0') / 10 ** (j.jetton?.decimals ?? 9);
    }
    lastStatus = res.status;
    await wait(700 + attempt * 800);
  }
  // Backup source: toncenter (DOGG has 9 decimals).
  for (let attempt = 0; attempt < 3; attempt++) {
    const tcKey = process.env['TONCENTER_API_KEY'];
    const res = await fetch(`https://toncenter.com/api/v3/jetton/wallets?owner_address=${encodeURIComponent(address)}&jetton_address=${JETTON}&limit=1`, tcKey ? { headers: { 'X-API-Key': tcKey } } : undefined);
    if (res.ok) {
      const j = await res.json() as { jetton_wallets?: { balance?: string }[] };
      return Number(j.jetton_wallets?.[0]?.balance ?? '0') / 1e9;
    }
    lastStatus = res.status;
    await wait(1100);
  }
  throw new Error(`No se pudo leer tu saldo de $DOGG (${lastStatus}). Inténtalo de nuevo.`);
}

type Admin = (typeof import('@/integrations/supabase/client.server'))['supabaseAdmin'];
/** Real hold of the player's linked wallet (45s cache; falls back to last known balance if TONAPI is busy). Every dogg_shift call must pass this — passing 0 would wrongly downgrade the miner. */
async function currentHold(supabaseAdmin: Admin, telegramId: number) {
  const row = await supabaseAdmin.from('dogg_players').select('wallet_address, last_hold, last_hold_at').eq('telegram_id', telegramId).maybeSingle();
  const wallet = row.data?.wallet_address ?? null;
  if (!wallet) return 0;
  const cached = row.data?.last_hold == null ? null : Number(row.data.last_hold);
  const fresh = row.data?.last_hold_at && Date.now() - Date.parse(row.data.last_hold_at) < 45_000;
  if (fresh && cached !== null) return cached;
  try {
    // With a known balance, never make the player wait more than 2.5 s for the chain: use the last one and refresh next time.
    const hold = cached === null ? await jettonHold(wallet) : await Promise.race([jettonHold(wallet), new Promise<never>((_, rej) => setTimeout(() => rej(new Error('slow')), 2500))]);
    await supabaseAdmin.from('dogg_players').update({ last_hold: hold, last_hold_at: new Date().toISOString() }).eq('telegram_id', telegramId);
    return hold;
  } catch (e) {
    if (cached === null) throw e;
    return cached;
  }
}

/** LP partner status of the linked wallet (DeDust liquidity, read on-chain; 60 s cache unless `fresh`). null = unknown, so dogg_shift keeps the stored status. */
async function currentLp(supabaseAdmin: Admin, telegramId: number, fresh = false): Promise<boolean | null> {
  const row = await supabaseAdmin.from('dogg_players').select('wallet_address, lp_active, lp_at').eq('telegram_id', telegramId).maybeSingle();
  const wallet = row.data?.wallet_address;
  if (!wallet) return row.data?.lp_active ? false : null;
  if (!fresh && row.data?.lp_at && Date.now() - Date.parse(row.data.lp_at) < 60_000) return null;
  try {
    const { lpTon } = await import('./lp.server');
    const { LP_MIN_TON } = await import('./lp');
    const ton = await Promise.race([lpTon(wallet), new Promise<never>((_, rej) => setTimeout(() => rej(new Error('slow')), fresh ? 8000 : 2500))]);
    await supabaseAdmin.from('dogg_players').update({ lp_ton: ton, lp_at: new Date().toISOString() }).eq('telegram_id', telegramId);
    return ton >= LP_MIN_TON;
  } catch (e) {
    if (fresh) console.error('lp read', e);
    return null;
  }
}

/** Parses a dogg_shift result and, if the hold now covers a better miner, switches to it automatically (accrued credit is checkpointed by dogg_shift). */
async function settle(supabaseAdmin: Admin, telegramId: number, data: unknown, hold: number) {
  const player = PlayerSchema.parse(data);
  const up = autoUpgradeId(player.minerId, player.balance, hold);
  if (!up) return { ...player, upgraded: null as string | null };
  const r = await supabaseAdmin.rpc('dogg_shift', { p_telegram_id: telegramId, p_action: `miner:${up}`, p_hold: hold });
  if (r.error) return { ...player, upgraded: null };
  return { ...PlayerSchema.parse(r.data), upgraded: up };
}

export const playerAction = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ initData: z.string().min(1).max(10000), action: z.enum(['read', 'start', 'claim', 'turbo', 'select']), minerId: z.string().max(40).optional(), ymid: z.string().uuid().optional(), device: z.object({ id: z.string().min(8).max(64), fp: z.string().min(8).max(128) }).optional(), refresh: z.boolean().optional() }))
  .handler(async ({ data }) => {
    const tg = await verifyTelegramUser(data.initData);
    // Background refreshes (every minute / on return) skip the once-per-open work to keep the backend light under heavy traffic.
    const opening = data.action === 'read' && !data.refresh;
    const telegramId = tg.id;
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    // On open: create the player, keep its Telegram name and attach the inviter (only for brand-new accounts).
    if (opening) await supabaseAdmin.rpc('dogg_register', { p_telegram_id: telegramId, p_referrer: tg.referrer as number, p_first_name: tg.firstName as string, p_username: tg.username as string });
    // Multi-account detector: hashed device + network signals on every open (informative only, never blocks).
    // Signals and the hold read run side by side so opening the app doesn't wait for one after the other.
    const signals = opening ? import('./multi.server').then(m => m.recordSignals(supabaseAdmin, telegramId, data.device, tg)) : Promise.resolve();
    const [hold, lp] = await Promise.all([currentHold(supabaseAdmin, telegramId), currentLp(supabaseAdmin, telegramId), signals]);
    const result = await supabaseAdmin.rpc('dogg_shift', { p_telegram_id: telegramId, p_action: data.action === 'select' ? `miner:${data.minerId ?? ''}` : data.action === 'turbo' ? `turbo:${data.ymid ?? ''}` : data.action, p_hold: hold, ...(lp === null ? {} : { p_lp: lp }) });
    if (result.error) throw new Error(result.error.message);
    const player = await settle(supabaseAdmin, telegramId, result.data, hold);
    // Tell the inviter (once) when this player joins with their link and when they start mining (+100).
    if (opening || data.action === 'start' || data.action === 'claim') {
      const { notifyReferral } = await import('./notify.server');
      await notifyReferral(supabaseAdmin, telegramId).catch(e => console.error('notifyReferral', e));
    }
    if (data.action !== 'read') return player;
    const { isAdmin } = await import('./telegram.server');
    const [ban, admin] = await Promise.all([
      supabaseAdmin.from('dogg_players').select('banned_at').eq('telegram_id', telegramId).maybeSingle(),
      isAdmin(supabaseAdmin, telegramId).catch(() => false),
    ]);
    return { ...player, isAdmin: admin, banned: Boolean(ban.data?.banned_at) };
  });

async function proofSig(telegramId: number, exp: number) {
  const secret = process.env['DOGG_PROOF_SECRET'];
  if (!secret) throw new Error('Falta configurar la verificación de wallets.');
  const { createHmac } = await import('node:crypto');
  return createHmac('sha256', secret).update(`${telegramId}.${exp}`).digest('hex').slice(0, 32);
}

/** One-time payload the wallet must sign (ton_proof) to prove ownership; bound to the Telegram account. */
export const walletChallenge = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ initData: z.string().min(1).max(10000) }))
  .handler(async ({ data }) => {
    const telegramId = await verifyTelegram(data.initData);
    const exp = Math.floor(Date.now() / 1000) + 15 * 60;
    return { payload: `${telegramId}.${exp}.${await proofSig(telegramId, exp)}` };
  });

const ProofSchema = z.object({
  timestamp: z.number().int(),
  domain: z.object({ lengthBytes: z.number().int(), value: z.string().max(253) }),
  payload: z.string().max(128),
  signature: z.string().max(200),
});

/** Candidate public keys for the wallet. The stateInit must hash to the address, so any key read from it is bound
 *  to that address; the ton_proof signature then picks the right one. No prior transaction or client publicKey needed. */
async function walletPublicKeys(address: string, publicKey: string | undefined, stateInit: string | undefined): Promise<string[]> {
  const keys: string[] = [];
  const add = (k: string) => { const v = k.toLowerCase(); if (/^[0-9a-f]{64}$/.test(v) && !keys.includes(v)) keys.push(v); };
  // 1) stateInit (works for new and deployed wallets: V1–V4, V5 beta, W5/V5R1).
  if (stateInit) {
    try {
      const { Cell, loadStateInit } = await import('@ton/core');
      const cell = Cell.fromBase64(stateInit);
      if (cell.hash().toString('hex') === address.split(':')[1]) {
        const data = loadStateInit(cell.beginParse()).data;
        if (data) {
          const want = publicKey?.toLowerCase();
          const found: string[] = [];
          for (const skip of [64, 1 + 32 + 32, 32, 1 + 32 + 80]) {
            try { const s = data.beginParse(); s.skip(skip); found.push(s.loadBuffer(32).toString('hex')); } catch { /* next layout */ }
          }
          if (want && found.includes(want)) add(want);
          found.forEach(add);
        }
      }
    } catch { /* invalid stateInit */ }
  }
  // 2) On-chain key (deployed wallets).
  try {
    const r = await fetch(`https://tonapi.io/v2/accounts/${encodeURIComponent(address)}/publickey`);
    if (r.ok) { const j = await r.json() as { public_key?: string }; if (j.public_key) add(j.public_key); }
  } catch { /* next source */ }
  if (!keys.length) try {
    const r = await fetch('https://toncenter.com/api/v2/runGetMethod', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address, method: 'get_public_key', stack: [] }) });
    if (r.ok) {
      const j = await r.json() as { ok?: boolean; result?: { exit_code?: number; stack?: [string, string][] } };
      const v = j.ok && j.result?.exit_code === 0 ? j.result.stack?.[0]?.[1] : undefined;
      if (v) add(BigInt(v).toString(16).padStart(64, '0'));
    }
  } catch { /* none */ }
  return keys;
}

/** Links the wallet only after verifying a TON Connect ownership signature (ton_proof). */
export const verifyWallet = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    initData: z.string().min(1).max(10000),
    address: z.string().regex(/^-?\d+:[0-9a-fA-F]{64}$/),
    publicKey: z.string().regex(/^[0-9a-fA-F]{64}$/).optional(),
    stateInit: z.string().max(10000).optional(),
    proof: ProofSchema,
  }))
  .handler(async ({ data }) => {
    const telegramId = await verifyTelegram(data.initData);
    const address = data.address.toLowerCase();
    const { proof } = data;
    const [pid, pexp, psig] = proof.payload.split('.');
    const exp = Number(pexp);
    if (Number(pid) !== telegramId || !exp || exp < Date.now() / 1000 || psig !== await proofSig(telegramId, exp)) throw new Error('La firma caducó. Vuelve a conectar tu wallet.');
    if (Math.abs(Date.now() / 1000 - proof.timestamp) > 15 * 60) throw new Error('La firma caducó. Vuelve a conectar tu wallet.');
    const { getRequestHeader } = await import('@tanstack/react-start/server');
    const host = (getRequestHeader('host') ?? '').split(':')[0];
    if (proof.domain.value !== host && proof.domain.value !== 'doggminer.lovable.app') throw new Error('Firma de otro dominio.');
    const pks = await walletPublicKeys(address, data.publicKey, data.stateInit);
    if (!pks.length) throw new Error('La firma de la wallet no es válida.');
    const { Buffer } = await import('node:buffer');
    const { createHash } = await import('node:crypto');
    const { signVerify } = await import('@ton/crypto');
    const [wc, hash] = address.split(':');
    const wcBuf = Buffer.alloc(4); wcBuf.writeInt32BE(Number(wc));
    const dl = Buffer.alloc(4); dl.writeUInt32LE(proof.domain.lengthBytes);
    const ts = Buffer.alloc(8); ts.writeBigUInt64LE(BigInt(proof.timestamp));
    const msg = Buffer.concat([Buffer.from('ton-proof-item-v2/'), wcBuf, Buffer.from(hash ?? '', 'hex'), dl, Buffer.from(proof.domain.value), ts, Buffer.from(proof.payload)]);
    const full = Buffer.concat([Buffer.from([0xff, 0xff]), Buffer.from('ton-connect'), createHash('sha256').update(msg).digest()]);
    const digest = createHash('sha256').update(full).digest();
    const sig = Buffer.from(proof.signature, 'base64');
    const ok = pks.some(pk => { try { return signVerify(digest, sig, Buffer.from(pk, 'hex')); } catch { return false; } });
    if (!ok) throw new Error('La firma de la wallet no es válida.');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const hold = await jettonHold(address);
    // Creates the row if needed; pass the real hold so linking never triggers a false downgrade.
    await supabaseAdmin.rpc('dogg_shift', { p_telegram_id: telegramId, p_action: 'read', p_hold: hold });
    // A valid signature proves ownership: release the wallet from any account that claimed it without proof.
    await supabaseAdmin.from('dogg_players').update({ wallet_address: null, wallet_verified_at: null, last_hold: null, last_hold_at: null }).eq('wallet_address', address).neq('telegram_id', telegramId);
    const upd = await supabaseAdmin.from('dogg_players').update({ wallet_address: address, wallet_verified_at: new Date().toISOString(), last_hold: hold, last_hold_at: new Date().toISOString() }).eq('telegram_id', telegramId);
    if (upd.error) throw new Error(upd.error.code === '23505' ? 'Esta wallet ya está vinculada a otra cuenta de Telegram.' : upd.error.message);
    // Remember every account that verified this wallet.
    await supabaseAdmin.from('dogg_wallet_links').upsert({ wallet_address: address, telegram_id: telegramId }, { onConflict: 'wallet_address,telegram_id', ignoreDuplicates: true });
    const result = await supabaseAdmin.rpc('dogg_shift', { p_telegram_id: telegramId, p_action: 'read', p_hold: hold });
    if (result.error) throw new Error(result.error.message);
    return settle(supabaseAdmin, telegramId, result.data, hold);
  });

/** Deducts balance atomically, queues the withdrawal and pays it automatically from the payout wallet. */
export const requestWithdraw = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ initData: z.string().min(1).max(10000), amount: z.number().int().min(1000).max(1_000_000_000) }))
  .handler(async ({ data }) => {
    const telegramId = await verifyTelegram(data.initData);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    // Commit the evidence-based decision before the withdrawal RPC so a rejected withdrawal cannot roll the ban back.
    const check = await supabaseAdmin.rpc('dogg_referral_farm_check', { p_referrer: telegramId });
    if (check.error) throw new Error(check.error.message);
    // Fresh on-chain LP check right before the withdrawal decides the fee (0 for LP partners).
    const lp = await currentLp(supabaseAdmin, telegramId, true);
    if (lp !== null) {
      const h = await currentHold(supabaseAdmin, telegramId).catch(() => null);
      if (h !== null) await supabaseAdmin.rpc('dogg_shift', { p_telegram_id: telegramId, p_action: 'read', p_hold: h, p_lp: lp });
    }
    const w = await supabaseAdmin.rpc('dogg_withdraw', { p_telegram_id: telegramId, p_amount: data.amount });
    if (w.error) throw new Error(w.error.message);
    const { processPayouts } = await import('./payout.server');
    await processPayouts(supabaseAdmin, 20_000);
    const row = await supabaseAdmin.from('dogg_withdrawals').select('status, error').eq('id', w.data).single();
    // If the hold can't be read right now, skip the refresh rather than reading with 0 (which would downgrade).
    const hold = await currentHold(supabaseAdmin, telegramId).catch(() => null);
    const player = hold === null ? null : await supabaseAdmin.rpc('dogg_shift', { p_telegram_id: telegramId, p_action: 'read', p_hold: hold });
    return { status: row.data?.status ?? 'pending', error: row.data?.error ?? null, player: !player || player.error || hold === null ? null : await settle(supabaseAdmin, telegramId, player.data, hold) };
  });

/** Rewarded ads: 'start' opens an ad view and returns its unique ymid for the Monetag SDK; 'status' reads it.
 *  The +5 $DOGG is paid only by the Monetag postback (/api/public/monetag-postback), never by the app. */
export const adAction = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ initData: z.string().min(1).max(10000), action: z.enum(['read', 'start', 'status', 'claim']), ymid: z.string().uuid().optional() }))
  .handler(async ({ data }) => {
    const telegramId = await verifyTelegram(data.initData);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const r = await supabaseAdmin.rpc('dogg_ad', { p_telegram_id: telegramId, p_action: data.action, ...(data.ymid ? { p_ymid: data.ymid } : {}) });
    if (r.error) throw new Error(r.error.message);
    return z.object({ adsToday: z.number(), balance: z.number(), ymid: z.string().optional(), status: z.string().optional() }).parse(r.data);
  });


/** Turbo 420: opens a server-side ad view (purpose turbo, never pays $DOGG) whose ymid the client shows, then passes to playerAction 'turbo'. */
export const turboAdAction = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ initData: z.string().min(1).max(10000) }))
  .handler(async ({ data }) => {
    const telegramId = await verifyTelegram(data.initData);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const r = await supabaseAdmin.rpc('dogg_turbo_ad', { p_telegram_id: telegramId });
    if (r.error) throw new Error(r.error.message);
    return { ymid: z.string().uuid().parse(r.data) };
  });

const FriendSchema = z.object({ name: z.string(), username: z.string().nullable(), joinedAt: z.string(), qualified: z.boolean(), given: z.number() });
/** Referrals: stats, one page of recruits (REF_PAGE per page) and claiming the pot (+100 per qualified recruit, 10% of their mining). */
export const referralAction = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ initData: z.string().min(1).max(10000), action: z.enum(['read', 'claim']), page: z.number().int().min(0).max(500).default(0) }))
  .handler(async ({ data }) => {
    const telegramId = await verifyTelegram(data.initData);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    if (data.action === 'claim') {
      const check = await supabaseAdmin.rpc('dogg_referral_farm_check', { p_referrer: telegramId });
      if (check.error) throw new Error(check.error.message);
    }
    const r = await supabaseAdmin.rpc('dogg_referral', { p_telegram_id: telegramId, p_action: data.action, p_page: data.page });
    if (r.error) throw new Error(r.error.message);
    return z.object({ total: z.number(), qualified: z.number(), pending: z.number(), earned: z.number(), balance: z.number(), claimed: z.number(), walletLinked: z.boolean(), page: z.number(), pages: z.number(), friends: z.array(FriendSchema) }).parse(r.data);
  });

/** Reuse one durable memo per account and linked wallet. */
export const openVerificationPayment = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ initData: z.string().min(1).max(10000) }))
  .handler(async ({ data }) => {
    const telegramId = await verifyTelegram(data.initData);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const row = await supabaseAdmin.from('dogg_players').select('withdraw_verified_at').eq('telegram_id', telegramId).maybeSingle();
    if (row.error) throw new Error(row.error.message);
    if (row.data?.withdraw_verified_at) return { verified: true as const };
    const { payoutRecipient } = await import('./payout.server');
    const r = await supabaseAdmin.rpc('dogg_open_verification', { p_telegram_id: telegramId, p_recipient: await payoutRecipient() });
    if (r.error) throw new Error(r.error.message);
    return z.union([z.object({ verified: z.literal(true) }), z.object({ verified: z.literal(false), memo: z.string(), recipient: z.string(), amount: z.string(), wallet: z.string() })]).parse(r.data);
  });

/** Wallet approval is not payment confirmation: verify receipt on-chain. */
export const verifyPurchase = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ initData: z.string().min(1).max(10000) }))
  .handler(async ({ data }) => {
    const telegramId = await verifyTelegram(data.initData);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const row = await supabaseAdmin.from('dogg_players').select('wallet_address, withdraw_verified_at, banned_at').eq('telegram_id', telegramId).maybeSingle();
    if (row.error) throw new Error(row.error.message);
    if (row.data?.banned_at) throw new Error('Cuenta suspendida');
    const wallet = row.data?.wallet_address;
    if (!wallet) throw new Error('Conecta y vincula tu wallet TON primero.');
    if (!row.data?.withdraw_verified_at) {
      const invoice = await supabaseAdmin.from('dogg_verification_payments').select('recipient').eq('telegram_id', telegramId).eq('wallet_address', wallet).maybeSingle();
      if (invoice.error) throw new Error(invoice.error.message);
      if (invoice.data) {
        const { checkVerification } = await import('./verification.server');
        await checkVerification(supabaseAdmin, invoice.data.recipient);
      }
    }
    const hold = await currentHold(supabaseAdmin, telegramId);
    const r = await supabaseAdmin.rpc('dogg_shift', { p_telegram_id: telegramId, p_action: 'read', p_hold: hold });
    if (r.error) throw new Error(r.error.message);
    return settle(supabaseAdmin, telegramId, r.data, hold);
  });

/** The player's real $DOGG movements (newest first, up to 500) for the PnL chart and history; withdrawals carry their live status. */
export const ledgerAction = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ initData: z.string().min(1).max(10000) }))
  .handler(async ({ data }) => {
    const telegramId = await verifyTelegram(data.initData);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const r = await supabaseAdmin.from('dogg_ledger').select('kind, label, amount, ref, created_at').eq('telegram_id', telegramId).order('created_at', { ascending: false }).limit(500);
    if (r.error) throw new Error(r.error.message);
    const rows = r.data ?? [];
    const ids = rows.filter(e => e.kind === 'withdraw' && e.label === 'hist.withdraw' && e.ref).map(e => e.ref as string);
    const open = new Set<string>();
    if (ids.length) {
      const w = await supabaseAdmin.from('dogg_withdrawals').select('id').in('id', ids).in('status', ['pending', 'sending']);
      for (const x of w.data ?? []) open.add(x.id);
    }
    // Earnings older than the 500 returned rows, so the "All" chart starts at the right height.
    let earnedBefore = 0;
    const oldest = rows[rows.length - 1]?.created_at;
    if (rows.length === 500 && oldest) {
      const older = await supabaseAdmin.from('dogg_ledger').select('amount').eq('telegram_id', telegramId).neq('kind', 'withdraw').gt('amount', 0).lt('created_at', oldest).limit(10000);
      earnedBefore = (older.data ?? []).reduce((a, e) => a + Number(e.amount), 0);
    }
    return {
      earnedBefore,
      entries: rows.map(e => ({ kind: e.kind as 'mining' | 'task' | 'withdraw' | 'team', label: e.label, amount: Number(e.amount), at: Date.parse(e.created_at), ...(e.ref && open.has(e.ref) ? { status: 'review' as const } : {}) })),
    };
  });

/** Unlinks the account's wallet so the player can connect a different one (a new ton_proof is required to link again). */
export const unlinkWallet = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ initData: z.string().min(1).max(10000) }))
  .handler(async ({ data }) => {
    const telegramId = await verifyTelegram(data.initData);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const upd = await supabaseAdmin.from('dogg_players').update({ wallet_address: null, wallet_verified_at: null, last_hold: null, last_hold_at: null }).eq('telegram_id', telegramId);
    if (upd.error) throw new Error(upd.error.message);
    // Without a wallet only the in-app balance counts toward the miner level.
    const result = await supabaseAdmin.rpc('dogg_shift', { p_telegram_id: telegramId, p_action: 'read', p_hold: 0 });
    if (result.error) throw new Error(result.error.message);
    return settle(supabaseAdmin, telegramId, result.data, 0);
  });

/** Records the miner level the player has been shown and returns the previous one, so a rank up is announced once per account on any device (UX only; no balances). */
export const markSeenLevel = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ initData: z.string().min(1).max(10000), level: z.number().int().min(1).max(10000) }))
  .handler(async ({ data }) => {
    const id = await verifyTelegram(data.initData);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const r = await supabaseAdmin.rpc('dogg_mark_level', { p_id: id, p_level: data.level });
    if (r.error) throw new Error(r.error.message);
    return { prev: Number(r.data) || 0 };
  });
