import { z } from 'zod';

export const publicRoundSchema = z.object({ id: z.string(), game: z.enum(['mines', 'spin']), bet: z.coerce.number(), payout: z.coerce.number(), played_at: z.string(), player_name: z.string().nullable() });
export type GlobalRound = z.infer<typeof publicRoundSchema>;

export function roundOutcome(round: Pick<GlobalRound, 'bet' | 'payout'>) {
  const net = Math.round((round.payout - round.bet) * 100) / 100;
  return { net, multiplier: round.bet > 0 ? round.payout / round.bet : 0, state: net > 0 ? 'profit' : net < 0 ? 'loss' : 'even' };
}