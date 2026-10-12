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
    for (let i = 1; i < 500; i++) { expect(MINERS[i].daily).toBeGreaterThanOrEqual(MINERS[i-1].daily); expect(MINERS[i].hold).toBeGreaterThanOrEqual(MINERS[i-1].hold); }
  });
});
