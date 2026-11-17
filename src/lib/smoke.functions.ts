import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { smokeResponseSchema } from './smoke';

export const smokeAction = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ initData: z.string().min(1).max(10000), action: z.enum(['read', 'create', 'join', 'start', 'finish', 'cancel']), room: z.string().uuid().optional(), bet: z.union([z.literal(10), z.literal(25), z.literal(50), z.literal(100)]).optional() }))
  .handler(async ({ data }) => {
    const { verifyTelegramUser } = await import('./telegram.server');
    const user = await verifyTelegramUser(data.initData);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const result = await supabaseAdmin.rpc('dogg_smoke', { p_telegram_id: user.id, p_action: data.action, ...(data.room ? { p_room: data.room } : {}), ...(data.bet ? { p_bet: data.bet } : {}) });
    if (result.error) throw new Error(result.error.message);
    return smokeResponseSchema.parse(result.data);
  });