import { describe, expect, it } from 'vitest';
import { shiftTotal, switchMiner } from '@/lib/mining';
import { SHIFT_MS } from '@/lib/dogg';
const start = Date.parse('2026-10-12T00:00:00Z');
const state = { minerId: 'rookie-1', shiftStartedAt: new Date(start).toISOString(), rateChangedAt: new Date(start).toISOString(), shiftAccrued: 0 };
describe('mining segments', () => {
  it('produces five DOGG in one day and freezes at expiry', () => {
    expect(shiftTotal(state, start + SHIFT_MS)).toBe(5);
    expect(shiftTotal(state, start + SHIFT_MS * 2)).toBe(5);
  });
  it('preserves earned credits and applies the new rate only going forward', () => {
    const changed = switchMiner(state, 'rookie-2', start + SHIFT_MS / 2);
    expect(shiftTotal(changed, start + SHIFT_MS / 2)).toBe(2.5);
    expect(shiftTotal(changed, start + SHIFT_MS)).toBe(5.5);
    expect(changed.shiftStartedAt).toBe(state.shiftStartedAt);
  });
  it('does not award credits for time before the segment or after expiry', () => {
    const changed = switchMiner(state, 'kingpin', start + SHIFT_MS * 2);
    expect(shiftTotal(changed, start + SHIFT_MS * 3)).toBe(5);
    expect(shiftTotal(state, start - 100)).toBe(0);
  });
  it('preserves multiple switches and returns zero without an active shift', () => {
    const first = switchMiner(state, 'rookie-2', start + SHIFT_MS / 4);
    const second = switchMiner(first, 'rookie-3', start + SHIFT_MS / 2);
    expect(shiftTotal(second, start + SHIFT_MS)).toBeCloseTo(6.125);
    expect(shiftTotal({ ...state, shiftStartedAt: null }, start + SHIFT_MS)).toBe(0);
  });
});import { MINERS, minerAt } from '@/lib/mining';
describe('miner catalog', () => {
  it('has 500 miners with rising power and hold', () => {
    expect(MINERS).toHaveLength(500);
    expect(minerAt(1).daily).toBe(5);
    for (let i = 1; i < 500; i++) { expect(MINERS[i]!.daily).toBeGreaterThanOrEqual(MINERS[i-1]!.daily); expect(MINERS[i]!.hold).toBeGreaterThanOrEqual(MINERS[i-1]!.hold); }
  });
});

import { bestLevel } from '@/lib/mining';
describe('hold unlocks miners', () => {
  it('unlocks levels as hold grows and drops them when it shrinks', () => {
    expect(bestLevel(0)).toBe(1);
    expect(bestLevel(2)).toBe(1);
    expect(bestLevel(3)).toBe(2);
    expect(bestLevel(4)).toBe(3);
    const rich = bestLevel(927_000);
    expect(rich).toBe(500);
    expect(bestLevel(1_000)).toBeLessThan(bestLevel(10_000));
    expect(minerAt(bestLevel(5_000)).hold).toBeLessThanOrEqual(5_000);
    expect(minerAt(bestLevel(5_000) + 1).hold).toBeGreaterThan(5_000);
  });
});

import { autoUpgradeId } from '@/lib/mining';
describe('automatic miner upgrade', () => {
  it('rises to the best miner the hold covers, never down', () => {
    expect(autoUpgradeId('rookie-1', 0, 927_000)).toBe('miner-500');
    expect(autoUpgradeId('rookie-1', 3, 2)).toBeNull();
    expect(autoUpgradeId('miner-500', 0, 5)).toBeNull();
    const id = autoUpgradeId('rookie-1', 1_000, 4_000)!;
    expect(minerAt(Number(id.split('-')[1])).hold).toBeLessThanOrEqual(5_000);
  });
});

import { streakBoost, liveStreak, TURBO_MS } from '@/lib/mining';
describe('daily streak and Turbo 420', () => {
  it('pays x1.05 from a 3-day streak and x1.15 from 7 days', () => {
    expect(streakBoost(2)).toBe(1);
    expect(streakBoost(3)).toBe(1.05);
    expect(streakBoost(6)).toBe(1.05);
    expect(streakBoost(7)).toBe(1.15);
  });
  it('keeps the streak only if the last start/claim was today or yesterday', () => {
    expect(liveStreak(5, '2026-10-12', Date.parse('2026-10-13T20:00:00Z'))).toBe(5);
    expect(liveStreak(5, '2026-10-12', Date.parse('2026-10-14T01:00:00Z'))).toBe(0);
  });
  it('applies the streak multiplier to the whole shift', () => {
    expect(shiftTotal({ ...state, shiftBoost: 1.15 }, start + SHIFT_MS)).toBeCloseTo(5.75);
  });
  it('doubles the rate for exactly 15 minutes of turbo, inside the shift only', () => {
    const turbo = { ...state, turboAt: new Date(start + 3600_000).toISOString() };
    expect(TURBO_MS).toBe(15 * 60_000);
    expect(shiftTotal(turbo, start + SHIFT_MS)).toBeCloseTo(5 + 5 * TURBO_MS / SHIFT_MS);
    const late = { ...state, turboAt: new Date(start + SHIFT_MS - 5 * 60_000).toISOString() };
    expect(shiftTotal(late, start + SHIFT_MS * 2)).toBeCloseTo(5 + 5 * 5 * 60_000 / SHIFT_MS);
  });
});
