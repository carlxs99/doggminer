import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import type { GlobalRound } from './game-history';

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

const Spin = z.object({ balance: z.number(), slots: z.array(z.number()), payout: z.number(), bet: z.number() });
export type SpinResult = z.infer<typeof Spin>;

/** Public, anonymous projection only; private source tables remain inaccessible. */
export const globalGameHistory = createServerFn({ method: 'GET' })
  .handler(async (): Promise<{ rounds: GlobalRound[]; unavailable: boolean }> => {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const url = process.env['SUPABASE_URL'];
      const key = process.env['SUPABASE_PUBLISHABLE_KEY'] ?? process.env['VITE_SUPABASE_PUBLISHABLE_KEY'];
      if (!url || !key) throw new Error('Configuración no disponible');
      const db = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: (input, init) => {
          const headers = new Headers(init?.headers);
          if (key.startsWith('sb_') && headers.get('Authorization') === `Bearer ${key}`) headers.delete('Authorization');
          headers.set('apikey', key);
          return fetch(input, { ...init, headers });
        } },
      });
      const result = await db.from('dogg_global_game_history').select('id,game,bet,payout,played_at').order('played_at', { ascending: false }).order('id', { ascending: false }).limit(20);
      if (result.error) throw new Error(result.error.message);
      const rounds = z.array(z.object({ id: z.string(), game: z.enum(['mines', 'spin']), bet: z.coerce.number(), payout: z.coerce.number(), played_at: z.string() })).parse(result.data);
      return { rounds, unavailable: false };
    } catch (error) {
      console.error('[game-history] Read failed', error instanceof Error ? error.message : 'unknown');
      return { rounds: [], unavailable: true };
    }
  });

/** Spin the Blunt: the slot is drawn in the database (dogg_spin); the client only animates it. */
export const spinAction = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ initData: z.string().min(1).max(10000), bet: z.number().int().min(5).max(100) }))
  .handler(async ({ data }) => {
    const id = (await (await import('./telegram.server')).verifyTelegramUser(data.initData)).id;
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const r = await supabaseAdmin.rpc('dogg_spin', { p_telegram_id: id, p_bet: data.bet });
    if (r.error) throw new Error(r.error.message);
    return Spin.parse(r.data);
  });
