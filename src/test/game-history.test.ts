import { describe, expect, it } from 'vitest';
import { publicRoundSchema, roundOutcome } from '@/lib/game-history';

describe('global round results', () => {
  it.each(['mines', 'spin'] as const)('includes the player name but strips private fields from %s rounds', game => {
    const round = publicRoundSchema.parse({ id: `${game}:1`, game, bet: '5', payout: '7', played_at: '2026-11-15T10:18:00Z', player_name: 'Carlos', telegram_id: 123, wallet_address: 'private-wallet', balance: 100, board: [1, 2] });
    expect(round).toEqual({ id: `${game}:1`, game, bet: 5, payout: 7, played_at: '2026-11-15T10:18:00Z', player_name: 'Carlos' });
  });
  it('preserves rounds whose player has no stored name', () => {
    expect(publicRoundSchema.parse({ id: 'mines:1', game: 'mines', bet: 5, payout: 0, played_at: '2026-11-15T10:18:00Z', player_name: null }).player_name).toBeNull();
  });
  it('classifies a partial payout as a loss rather than a win', () => {
    expect(roundOutcome({ bet: 10, payout: 5 })).toEqual({ net: -5, multiplier: 0.5, state: 'loss' });
  });
  it('shows a bust with zero payout', () => {
    expect(roundOutcome({ bet: 100, payout: 0 })).toEqual({ net: -100, multiplier: 0, state: 'loss' });
  });
  it('distinguishes a returned stake from a profit', () => {
    expect(roundOutcome({ bet: 5, payout: 5 })).toEqual({ net: 0, multiplier: 1, state: 'even' });
    expect(roundOutcome({ bet: 5, payout: 7 })).toEqual({ net: 2, multiplier: 1.4, state: 'profit' });
  });
});