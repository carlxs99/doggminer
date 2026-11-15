import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

const Round = z.object({ balance: z.number(), id: z.string().optional(), bet: z.number().optional(), mines: z.number().optional(), revealed: z.array(z.number()).optional(), status: z.enum(['active', 'won', 'lost']).optional(), payout: z.number().optional(), mult: z.number().optional(), next: z.number().optional(), board: z.array(z.number()).nullable().optional(), hit: z.number().optional() });
export type MinesRound = z.infer<typeof Round>;

/** DOGG Mines: the board lives only in the database (dogg_mines) until the round ends; every tap is checked server-side. */
export const minesAction = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ initData: z.string().min(1).max(10000), action: z.enum(['read', 'start', 'reveal', 'cashout']), bet: z.number().int().min(5).max(100).optional(), mines: z.union([z.literal(3), z.literal(5), z.literal(10)]).optional(), tile: z.number().int().min(0).max(24).optional() }))
  .handler(async ({ data }) => {
    const id = (await (await import('./telegram.server')).verifyTelegramUser(data.initData)).id;
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const r = await supabaseAdmin.rpc('dogg_mines', { p_telegram_id: id, p_action: data.action, ...(data.bet ? { p_bet: data.bet } : {}), ...(data.mines ? { p_mines: data.mines } : {}), ...(data.tile !== undefined ? { p_tile: data.tile } : {}) });
    if (r.error) throw new Error(r.error.message);
    return Round.parse(r.data);
  });
