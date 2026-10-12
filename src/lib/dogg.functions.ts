import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

export const playerAction = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ initData: z.string().min(1).max(10000), action: z.enum(['read', 'start', 'claim', 'checkin', 'select']), minerId: z.string().max(40).optional() }))
  .handler(async ({ data }) => {
    const token = process.env['TELEGRAM_BOT_TOKEN'];
    if (!token) throw new Error('El bot todavía no está configurado. El minado real no está disponible.');
    const { createHmac, timingSafeEqual } = await import('node:crypto');
    const params = new URLSearchParams(data.initData);
    const hash = params.get('hash');
    params.delete('hash');
    const check = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
    const secret = createHmac('sha256', 'WebAppData').update(token).digest();
    const expected = createHmac('sha256', secret).update(check).digest();
    const actual = Buffer.from(hash ?? '', 'hex');
    const authDate = Number(params.get('auth_date'));
    const now = Math.floor(Date.now() / 1000);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected) || !authDate || now - authDate > 86400 || authDate > now + 30) throw new Error('Abre de nuevo la mini app desde Telegram.');
    const user = z.object({ id: z.number().int().positive() }).parse(JSON.parse(params.get('user') ?? '{}'));
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const result = await supabaseAdmin.rpc('dogg_shift', { p_telegram_id: user.id, p_action: data.action === 'select' ? `miner:${data.minerId ?? ''}` : data.action });
    if (result.error) throw new Error(result.error.message);
    return z.object({ balance: z.number(), shiftStartedAt: z.string().nullable(), claimedShifts: z.number(), streak: z.number(), lastCheckin: z.string().nullable(), minerId: z.string(), shiftAccrued: z.number(), rateChangedAt: z.string().nullable() }).parse(result.data);
  });