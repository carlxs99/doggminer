import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { JETTON } from './dogg';

const PlayerSchema = z.object({ balance: z.number(), shiftStartedAt: z.string().nullable(), claimedShifts: z.number(), streak: z.number(), lastCheckin: z.string().nullable(), minerId: z.string(), shiftAccrued: z.number(), rateChangedAt: z.string().nullable(), walletAddress: z.string().nullable().optional(), hold: z.number().optional() });

async function verifyTelegram(initData: string) {
  const token = process.env['TELEGRAM_BOT_TOKEN'];
  if (!token) throw new Error('El bot todavía no está configurado. El minado real no está disponible.');
  const { createHmac, timingSafeEqual } = await import('node:crypto');
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  params.delete('hash');
  const check = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const expected = createHmac('sha256', secret).update(check).digest();
  const actual = Buffer.from(hash ?? '', 'hex');
  const authDate = Number(params.get('auth_date'));
  const now = Math.floor(Date.now() / 1000);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected) || !authDate || now - authDate > 86400 || authDate > now + 30) throw new Error('Abre de nuevo la mini app desde Telegram.');
  return z.object({ id: z.number().int().positive() }).parse(JSON.parse(params.get('user') ?? '{}')).id;
}

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
    const res = await fetch(`https://toncenter.com/api/v3/jetton/wallets?owner_address=${encodeURIComponent(address)}&jetton_address=${JETTON}&limit=1`);
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

export const playerAction = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ initData: z.string().min(1).max(10000), action: z.enum(['read', 'start', 'claim', 'checkin', 'select']), minerId: z.string().max(40).optional() }))
  .handler(async ({ data }) => {
    const telegramId = await verifyTelegram(data.initData);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const hold = await currentHold(supabaseAdmin, telegramId);
    const result = await supabaseAdmin.rpc('dogg_shift', { p_telegram_id: telegramId, p_action: data.action === 'select' ? `miner:${data.minerId ?? ''}` : data.action, p_hold: hold });
    if (result.error) throw new Error(result.error.message);
    return PlayerSchema.parse(result.data);
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
    const result = await supabaseAdmin.rpc('dogg_shift', { p_telegram_id: telegramId, p_action: 'read', p_hold: hold });
    if (result.error) throw new Error(result.error.message);
    return PlayerSchema.parse(result.data);
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
    await processPayouts(supabaseAdmin);
    const row = await supabaseAdmin.from('dogg_withdrawals').select('status, error').eq('id', w.data).single();
    // If the hold can't be read right now, skip the refresh rather than reading with 0 (which would downgrade).
    const hold = await currentHold(supabaseAdmin, telegramId).catch(() => null);
    const player = hold === null ? null : await supabaseAdmin.rpc('dogg_shift', { p_telegram_id: telegramId, p_action: 'read', p_hold: hold });
    return { status: row.data?.status ?? 'pending', error: row.data?.error ?? null, player: !player || player.error ? null : PlayerSchema.parse(player.data) };
  });
