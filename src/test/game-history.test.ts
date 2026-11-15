import { describe, expect, it } from 'vitest';
import { roundOutcome } from '@/lib/game-history';

describe('global round results', () => {
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