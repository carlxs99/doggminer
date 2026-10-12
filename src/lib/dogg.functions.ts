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
  const res = await fetch(`https://tonapi.io/v2/accounts/${encodeURIComponent(address)}/jettons/${JETTON}`);
  if (res.status === 404) return 0;
  if (!res.ok) throw new Error(`No se pudo leer tu saldo de $DOGG (${res.status}). Inténtalo de nuevo.`);
  const j = await res.json() as { balance?: string; jetton?: { decimals?: number } };
  return Number(j.balance ?? '0') / 10 ** (j.jetton?.decimals ?? 9);
}

export const playerAction = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ initData: z.string().min(1).max(10000), action: z.enum(['read', 'start', 'claim', 'checkin', 'select']), minerId: z.string().max(40).optional() }))
  .handler(async ({ data }) => {
    const telegramId = await verifyTelegram(data.initData);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const row = await supabaseAdmin.from('dogg_players').select('wallet_address').eq('telegram_id', telegramId).maybeSingle();
    const wallet = row.data?.wallet_address ?? null;
    const hold = wallet && (data.action === 'select' || data.action === 'claim' || data.action === 'read') ? await jettonHold(wallet) : 0;
    const result = await supabaseAdmin.rpc('dogg_shift', { p_telegram_id: telegramId, p_action: data.action === 'select' ? `miner:${data.minerId ?? ''}` : data.action, p_hold: hold });
    if (result.error) throw new Error(result.error.message);
    return PlayerSchema.parse(result.data);
  });

/** Signed, short-lived payload the wallet must sign (ton_proof). Stateless: HMAC over a timestamp + nonce. */
export const proofPayload = createServerFn({ method: 'POST' }).handler(async () => {
  const { createHmac, randomBytes } = await import('node:crypto');
  const body = `${Date.now().toString(36)}.${randomBytes(8).toString('hex')}`;
  const sig = createHmac('sha256', process.env['DOGG_PROOF_SECRET']!).update(body).digest('hex').slice(0, 32);
  return { payload: `${body}.${sig}` };
});

export const verifyWallet = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    initData: z.string().min(1).max(10000),
    address: z.string().regex(/^-?\d+:[0-9a-fA-F]{64}$/),
    proof: z.object({ timestamp: z.number(), domain: z.object({ lengthBytes: z.number(), value: z.string().max(256) }), payload: z.string().max(200), signature: z.string().max(200) }),
  }))
  .handler(async ({ data }) => {
    const telegramId = await verifyTelegram(data.initData);
    const [{ createHmac, createHash, timingSafeEqual }, { Buffer }] = await Promise.all([import('node:crypto'), import('node:buffer')]);
    const [ts = '', nonce = '', sig] = data.proof.payload.split('.');
    const expect = createHmac('sha256', process.env['DOGG_PROOF_SECRET']!).update(`${ts}.${nonce}`).digest('hex').slice(0, 32);
    if (!sig || sig.length !== expect.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expect)) || Date.now() - parseInt(ts, 36) > 15 * 60_000) throw new Error('La firma caducó. Desconecta y vuelve a conectar la wallet.');
    if (Math.abs(Date.now() / 1000 - data.proof.timestamp) > 15 * 60) throw new Error('La firma caducó. Vuelve a conectar la wallet.');

    const [wcStr = '0', hashHex = ''] = data.address.split(':');
    const wc = Buffer.alloc(4); wc.writeInt32BE(Number(wcStr));
    const domain = Buffer.from(data.proof.domain.value, 'utf8');
    const dl = Buffer.alloc(4); dl.writeUInt32LE(domain.length);
    const tsb = Buffer.alloc(8); tsb.writeBigUInt64LE(BigInt(data.proof.timestamp));
    const msg = Buffer.concat([Buffer.from('ton-proof-item-v2/'), wc, Buffer.from(hashHex, 'hex'), dl, domain, tsb, Buffer.from(data.proof.payload)]);
    const full = Buffer.concat([Buffer.from([0xff, 0xff]), Buffer.from('ton-connect'), createHash('sha256').update(msg).digest()]);
    const digest = createHash('sha256').update(full).digest();

    const pkRes = await fetch(`https://tonapi.io/v2/accounts/${encodeURIComponent(data.address)}/publickey`);
    if (!pkRes.ok) throw new Error('Tu wallet aún no está activada en la red. Haz una transacción con ella y vuelve a intentarlo.');
    const { public_key } = await pkRes.json() as { public_key: string };
    const nacl = (await import('tweetnacl')).default;
    const ok = nacl.sign.detached.verify(new Uint8Array(digest), new Uint8Array(Buffer.from(data.proof.signature, 'base64')), new Uint8Array(Buffer.from(public_key, 'hex')));
    if (!ok) throw new Error('No se pudo comprobar que la wallet es tuya.');

    const address = data.address.toLowerCase();
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    await supabaseAdmin.rpc('dogg_shift', { p_telegram_id: telegramId, p_action: 'read', p_hold: 0 });
    const upd = await supabaseAdmin.from('dogg_players').update({ wallet_address: address, wallet_verified_at: new Date().toISOString() }).eq('telegram_id', telegramId);
    if (upd.error) throw new Error(upd.error.code === '23505' ? 'Esta wallet ya está vinculada a otra cuenta de Telegram.' : upd.error.message);
    const result = await supabaseAdmin.rpc('dogg_shift', { p_telegram_id: telegramId, p_action: 'read', p_hold: await jettonHold(address) });
    if (result.error) throw new Error(result.error.message);
    return PlayerSchema.parse(result.data);
  });
