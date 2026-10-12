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
    const hold = wallet ? await jettonHold(wallet) : 0;
    const result = await supabaseAdmin.rpc('dogg_shift', { p_telegram_id: telegramId, p_action: data.action === 'select' ? `miner:${data.minerId ?? ''}` : data.action, p_hold: hold });
    if (result.error) throw new Error(result.error.message);
    return PlayerSchema.parse(result.data);
  });

/** Links the connected wallet to the Telegram account (no ownership signature). */
export const verifyWallet = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    initData: z.string().min(1).max(10000),
    address: z.string().regex(/^-?\d+:[0-9a-fA-F]{64}$/),
  }))
  .handler(async ({ data }) => {
    const telegramId = await verifyTelegram(data.initData);
    const address = data.address.toLowerCase();
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    await supabaseAdmin.rpc('dogg_shift', { p_telegram_id: telegramId, p_action: 'read', p_hold: 0 });
    const upd = await supabaseAdmin.from('dogg_players').update({ wallet_address: address, wallet_verified_at: new Date().toISOString() }).eq('telegram_id', telegramId);
    if (upd.error) throw new Error(upd.error.code === '23505' ? 'Esta wallet ya está vinculada a otra cuenta de Telegram.' : upd.error.message);
    const result = await supabaseAdmin.rpc('dogg_shift', { p_telegram_id: telegramId, p_action: 'read', p_hold: await jettonHold(address) });
    if (result.error) throw new Error(result.error.message);
    return PlayerSchema.parse(result.data);
  });
