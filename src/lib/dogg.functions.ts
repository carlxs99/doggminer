import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { JETTON } from './dogg';
import { autoUpgradeId } from './mining';
import { purchasedDogg, purchasedFromTransfers, type TonapiEvent, type ToncenterTransfer } from './purchase';

const PlayerSchema = z.object({ balance: z.number(), shiftStartedAt: z.string().nullable(), claimedShifts: z.number(), streak: z.number(), lastCheckin: z.string().nullable(), minerId: z.string(), shiftAccrued: z.number(), rateChangedAt: z.string().nullable(), walletAddress: z.string().nullable().optional(), hold: z.number().optional(), downgraded: z.string().nullable().optional(), withdrawVerified: z.boolean().optional() });

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
    const hold = await jettonHold(wallet);
    await supabaseAdmin.from('dogg_players').update({ last_hold: hold, last_hold_at: new Date().toISOString() }).eq('telegram_id', telegramId);
    return hold;
  } catch (e) {
    if (cached === null) throw e;
    return cached;
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
  .inputValidator(z.object({ initData: z.string().min(1).max(10000), action: z.enum(['read', 'start', 'claim', 'checkin', 'select']), minerId: z.string().max(40).optional() }))
  .handler(async ({ data }) => {
    const tg = await verifyTelegramUser(data.initData);
    const telegramId = tg.id;
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    // On open: create the player, keep its Telegram name and attach the inviter (only for brand-new accounts).
    if (data.action === 'read') await supabaseAdmin.rpc('dogg_register', { p_telegram_id: telegramId, p_referrer: tg.referrer as number, p_first_name: tg.firstName as string, p_username: tg.username as string });
    const hold = await currentHold(supabaseAdmin, telegramId);
    const result = await supabaseAdmin.rpc('dogg_shift', { p_telegram_id: telegramId, p_action: data.action === 'select' ? `miner:${data.minerId ?? ''}` : data.action, p_hold: hold });
    if (result.error) throw new Error(result.error.message);
    const player = await settle(supabaseAdmin, telegramId, result.data, hold);
    // Tell the inviter (once) when this player joins with their link and when they start mining (+100).
    if (data.action === 'read' || data.action === 'start' || data.action === 'claim') {
      const { notifyReferral } = await import('./notify.server');
      await notifyReferral(supabaseAdmin, telegramId);
    }
    if (data.action !== 'read') return player;
    const { isAdmin } = await import('./telegram.server');
    return { ...player, isAdmin: await isAdmin(supabaseAdmin, telegramId) };
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

async function walletPublicKey(address: string, publicKey: string | undefined, stateInit: string | undefined) {
  try {
    const r = await fetch(`https://tonapi.io/v2/accounts/${encodeURIComponent(address)}/publickey`);
    if (r.ok) { const j = await r.json() as { public_key?: string }; if (j.public_key) return j.public_key.toLowerCase(); }
  } catch { /* fall through to stateInit */ }
  if (!publicKey || !stateInit) return null;
  // Undeployed wallet: stateInit must hash to the address and embed the claimed key.
  const { Cell, loadStateInit } = await import('@ton/core');
  const cell = Cell.fromBase64(stateInit);
  if (cell.hash().toString('hex') !== address.split(':')[1]) return null;
  const data = loadStateInit(cell.beginParse()).data;
  if (!data || !data.bits.toString().toLowerCase().includes(publicKey.toLowerCase())) return null;
  return publicKey.toLowerCase();
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
    const pk = await walletPublicKey(address, data.publicKey, data.stateInit);
    if (!pk) throw new Error('No se pudo comprobar la clave de tu wallet. Haz al menos una transacción con ella e inténtalo de nuevo.');
    const { Buffer } = await import('node:buffer');
    const { createHash } = await import('node:crypto');
    const { signVerify } = await import('@ton/crypto');
    const [wc, hash] = address.split(':');
    const wcBuf = Buffer.alloc(4); wcBuf.writeInt32BE(Number(wc));
    const dl = Buffer.alloc(4); dl.writeUInt32LE(proof.domain.lengthBytes);
    const ts = Buffer.alloc(8); ts.writeBigUInt64LE(BigInt(proof.timestamp));
    const msg = Buffer.concat([Buffer.from('ton-proof-item-v2/'), wcBuf, Buffer.from(hash ?? '', 'hex'), dl, Buffer.from(proof.domain.value), ts, Buffer.from(proof.payload)]);
    const full = Buffer.concat([Buffer.from([0xff, 0xff]), Buffer.from('ton-connect'), createHash('sha256').update(msg).digest()]);
    const ok = signVerify(createHash('sha256').update(full).digest(), Buffer.from(proof.signature, 'base64'), Buffer.from(pk, 'hex'));
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
 *  The +15 $DOGG is paid only by the Monetag postback (/api/public/monetag-postback), never by the app. */
export const adAction = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ initData: z.string().min(1).max(10000), action: z.enum(['read', 'start', 'status']), ymid: z.string().uuid().optional() }))
  .handler(async ({ data }) => {
    const telegramId = await verifyTelegram(data.initData);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const r = await supabaseAdmin.rpc('dogg_ad', { p_telegram_id: telegramId, p_action: data.action, ...(data.ymid ? { p_ymid: data.ymid } : {}) });
    if (r.error) throw new Error(r.error.message);
    return z.object({ adsToday: z.number(), balance: z.number(), ymid: z.string().optional(), status: z.string().optional() }).parse(r.data);
  });


const FriendSchema = z.object({ name: z.string(), username: z.string().nullable(), joinedAt: z.string(), qualified: z.boolean(), given: z.number() });
/** Referrals: stats, recent recruits and claiming the pot (+100 per qualified recruit, 10% of their mining). */
export const referralAction = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ initData: z.string().min(1).max(10000), action: z.enum(['read', 'claim']) }))
  .handler(async ({ data }) => {
    const telegramId = await verifyTelegram(data.initData);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const r = await supabaseAdmin.rpc('dogg_referral', { p_telegram_id: telegramId, p_action: data.action });
    if (r.error) throw new Error(r.error.message);
    return z.object({ total: z.number(), qualified: z.number(), pending: z.number(), earned: z.number(), balance: z.number(), claimed: z.number(), walletLinked: z.boolean(), friends: z.array(FriendSchema) }).parse(r.data);
  });

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Primary source: toncenter (keyed, so it isn't throttled like anonymous TONAPI). Incoming $DOGG transfers, up to 2,000. */
async function boughtViaToncenter(address: string) {
  const key = process.env['TONCENTER_API_KEY'];
  const transfers: ToncenterTransfer[] = [];
  for (let page = 0; page < 4; page++) {
    let res: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      res = await fetch(`https://toncenter.com/api/v3/jetton/transfers?owner_address=${encodeURIComponent(address)}&jetton_master=${JETTON}&direction=in&limit=500&offset=${page * 500}&sort=desc`, key ? { headers: { 'X-API-Key': key } } : undefined);
      if (res.ok) break;
      await wait(800 + attempt * 800);
    }
    if (!res?.ok) throw new Error(`toncenter ${res?.status ?? 0}`);
    const j = await res.json() as { jetton_transfers?: ToncenterTransfer[] };
    const list = j.jetton_transfers ?? [];
    transfers.push(...list);
    if (list.length < 500) break;
  }
  return purchasedFromTransfers(transfers, address);
}

/** Backup source: TONAPI jetton history (up to 500 events). */
async function boughtViaTonapi(address: string) {
  const key = process.env['TONAPI_KEY'];
  const events: TonapiEvent[] = [];
  let before = '';
  for (let page = 0; page < 5; page++) {
    let res: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      res = await fetch(`https://tonapi.io/v2/accounts/${encodeURIComponent(address)}/jettons/${JETTON}/history?limit=100${before ? `&before_lt=${before}` : ''}`, key ? { headers: { Authorization: `Bearer ${key}` } } : undefined);
      if (res.ok || res.status === 404) break;
      await wait(900 + attempt * 900);
    }
    if (!res || res.status === 404) break;
    if (!res.ok) throw new Error(`tonapi ${res.status}`);
    const j = await res.json() as { events?: TonapiEvent[]; next_from?: number };
    events.push(...(j.events ?? []));
    if (!j.next_from || !j.events?.length) break;
    before = String(j.next_from);
  }
  return purchasedDogg(events, address);
}

/** $DOGG the wallet has bought on a DEX, read server-side from its on-chain history (toncenter, then TONAPI). */
async function boughtDogg(address: string) {
  try { return await boughtViaToncenter(address); } catch (e) { console.error('purchase check: toncenter failed', e); }
  try { return await boughtViaTonapi(address); } catch (e) { console.error('purchase check: tonapi failed', e); }
  // No status code in the message: it must read as "couldn't check", not as a traffic error.
  throw new Error('No se pudo comprobar tu compra ahora mismo. Inténtalo en un minuto.');
}

/** One-time withdrawal verification: the linked wallet must have bought >= 100 $DOGG. Once passed, it's permanent. */
export const verifyPurchase = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ initData: z.string().min(1).max(10000) }))
  .handler(async ({ data }) => {
    const telegramId = await verifyTelegram(data.initData);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const row = await supabaseAdmin.from('dogg_players').select('wallet_address, withdraw_verified_at').eq('telegram_id', telegramId).maybeSingle();
    const wallet = row.data?.wallet_address;
    if (!wallet) throw new Error('Conecta y vincula tu wallet TON primero.');
    if (!row.data?.withdraw_verified_at) {
      const bought = await boughtDogg(wallet);
      const v = await supabaseAdmin.rpc('dogg_verify_withdraw', { p_telegram_id: telegramId, p_wallet: wallet, p_bought: bought });
      if (v.error) throw new Error(v.error.message);
    }
    const hold = await currentHold(supabaseAdmin, telegramId);
    const r = await supabaseAdmin.rpc('dogg_shift', { p_telegram_id: telegramId, p_action: 'read', p_hold: hold });
    if (r.error) throw new Error(r.error.message);
    return settle(supabaseAdmin, telegramId, r.data, hold);
  });
