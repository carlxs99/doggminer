import { describe, expect, it } from 'vitest';
import { effectiveDaily, LP_MIN_TON } from '@/lib/lp';
import { withdrawFee, withdrawNet } from '@/lib/withdraw';
import { shiftTotal } from '@/lib/mining';

describe('LP partner miner', () => {
  it('needs at least 2 TON of liquidity', () => { expect(LP_MIN_TON).toBe(2); });
  it('mines 50 $DOGG/day when the miner makes less', () => { expect(effectiveDaily(5, true)).toBe(50); expect(effectiveDaily(5, false)).toBe(5); });
  it('keeps a higher miner rate', () => { expect(effectiveDaily(80, true)).toBe(80); });
  it('withdraws 1000 with no fee', () => { expect(withdrawFee(true)).toBe(0); expect(withdrawNet(1000, true)).toBe(1000); expect(withdrawNet(1000)).toBe(930); });
  it('a full shift as LP partner pays 50', () => {
    const start = new Date(Date.now() - 86_400_000).toISOString();
    expect(shiftTotal({ minerId: 'rookie-1', shiftAccrued: 0, rateChangedAt: start, shiftStartedAt: start, lpActive: true }, Date.now())).toBeCloseTo(50, 3);
  });
});
