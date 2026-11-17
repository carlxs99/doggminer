import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
async function requireVerified(id: number) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const row = await supabaseAdmin.from('dogg_players').select('withdraw_verified_at').eq('telegram_id', id).maybeSingle();
  if (row.error) throw new Error(row.error.message);
  if (!row.data?.withdraw_verified_at) throw new Error('Verifica tu wallet para poder jugar');
}
import { publicRoundSchema, type GlobalRound } from './game-history';

const Round = z.object({ balance: z.number(), id: z.string().optional(), bet: z.number().optional(), mines: z.number().optional(), revealed: z.array(z.number()).optional(), status: z.enum(['active', 'won', 'lost']).optional(), payout: z.number().optional(), mult: z.number().optional(), next: z.number().optional(), board: z.array(z.number()).nullable().optional(), hit: z.number().optional() });
export type MinesRound = z.infer<typeof Round>;

/** DOGG Mines: the board lives only in the database (dogg_mines) until the round ends; every tap is checked server-side. */
export const minesAction = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ initData: z.string().min(1).max(10000), action: z.enum(['read', 'start', 'reveal', 'cashout']), bet: z.number().int().min(5).max(100).optional(), mines: z.union([z.literal(3), z.literal(5), z.literal(10)]).optional(), tile: z.number().int().min(0).max(24).optional() }))
  .handler(async ({ data }) => {
    const id = (await (await import('./telegram.server')).verifyTelegramUser(data.initData)).id;
    await requireVerified(id);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const r = await supabaseAdmin.rpc('dogg_mines', { p_telegram_id: id, p_action: data.action, ...(data.bet ? { p_bet: data.bet } : {}), ...(data.mines ? { p_mines: data.mines } : {}), ...(data.tile !== undefined ? { p_tile: data.tile } : {}) });
    if (r.error) throw new Error(r.error.message);
    return Round.parse(r.data);
  });

const Spin = z.object({ balance: z.number(), slots: z.array(z.number()), payout: z.number(), bet: z.number() });
export type SpinResult = z.infer<typeof Spin>;

/** Public completed rounds with display names only; private source tables remain inaccessible. */
export const globalGameHistory = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ game: z.enum(['mines', 'spin', 'flip', 'battle']) }))
  .handler(async ({ data }): Promise<{ rounds: GlobalRound[]; unavailable: boolean }> => {
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
      const result = await db.from(data.game === 'battle' ? 'dogg_smoke_public_history' : 'dogg_global_game_history').select('id,game,bet,payout,played_at,player_name').eq('game', data.game).order('played_at', { ascending: false }).order('id', { ascending: false }).limit(20);
      if (result.error) throw new Error(result.error.message);
      const rounds = z.array(publicRoundSchema).parse(result.data);
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
    await requireVerified(id);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const r = await supabaseAdmin.rpc('dogg_spin', { p_telegram_id: id, p_bet: data.bet });
    if (r.error) throw new Error(r.error.message);
    return Spin.parse(r.data);
  });

const Flip = z.object({ balance: z.number(), result: z.enum(['heads', 'tails']), side: z.enum(['heads', 'tails']), payout: z.number(), bet: z.number() });
export type FlipResult = z.infer<typeof Flip>;

/** Flip the DOGG Coin: the coin is flipped in the database (dogg_flip, 50/50, x1.95); the client only animates it. */
export const flipAction = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ initData: z.string().min(1).max(10000), bet: z.number().int().min(5).max(100), side: z.enum(['heads', 'tails']) }))
  .handler(async ({ data }) => {
    const id = (await (await import('./telegram.server')).verifyTelegramUser(data.initData)).id;
    await requireVerified(id);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const r = await supabaseAdmin.rpc('dogg_flip', { p_telegram_id: id, p_bet: data.bet, p_side: data.side });
    if (r.error) throw new Error(r.error.message);
    return Flip.parse(r.data);
  });
