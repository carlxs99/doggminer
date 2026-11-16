import { describe, it, expect } from 'vitest';
import { effectiveDaily, lpDailyFor, LP_APY, LP_MIN_TON } from '@/lib/lp';
import { withdrawFee } from '@/lib/withdraw';

describe('LP staking', () => {
  it('needs at least 2 GRAM of liquidity', () => { expect(LP_MIN_TON).toBe(2); });
  it('pays 60% APY on the position value', () => { expect(LP_APY).toBe(0.6); expect(lpDailyFor(10000)).toBeCloseTo(16.4384, 3); expect(lpDailyFor(100000) * 30).toBeCloseTo(4931.5, 0); });
  it('is proportional, with no fixed floor', () => { expect(lpDailyFor(1000)).toBeCloseTo(1.6438, 3); expect(lpDailyFor(0)).toBe(0); });
  it('pays the higher of miner and staking, never both', () => { expect(effectiveDaily(5, true, 16.4)).toBe(16.4); expect(effectiveDaily(80, true, 16.4)).toBe(80); expect(effectiveDaily(5, false, 16.4)).toBe(5); });
  it('keeps withdrawals fee-free for LP partners', () => { expect(withdrawFee(true)).toBe(0); });
});
