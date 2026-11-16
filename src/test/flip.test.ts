import { describe, expect, it } from 'vitest';
import { FLIP_MULT, FLIP_BETS, flipPayout } from '@/lib/flip';
describe('flip the dogg coin', () => {
  it('pays x1.95 on a correct call', () => { expect(FLIP_MULT).toBe(1.95); expect(flipPayout(10)).toBe(19.5); expect(flipPayout(100)).toBe(195); });
  it('allows bets 5 to 100', () => { expect([...FLIP_BETS]).toEqual([5, 10, 25, 50, 100]); });
  it('has a 2.5% house edge', () => { expect(1 - 0.5 * FLIP_MULT).toBeCloseTo(0.025); });
});
