import { describe, expect, it } from 'vitest';
import { SPIN_SLOTS, SPIN_WEIGHTS, spinRtp } from '@/lib/spin';

describe('Spin the Blunt', () => {
  it('has 20 slots with one x25 jackpot, one free spin and two busts', () => {
    expect(SPIN_SLOTS).toHaveLength(20);
    expect(SPIN_SLOTS.filter(m => m === 25)).toHaveLength(1);
    expect(SPIN_SLOTS.filter(m => m === -1)).toHaveLength(1);
    expect(SPIN_SLOTS.filter(m => m === 0)).toHaveLength(2);
  });
  it('weights sum to 10000 and keep a ~4.5% house edge', () => {
    expect(SPIN_WEIGHTS.reduce((a, b) => a + b, 0)).toBe(10000);
    expect(spinRtp()).toBeGreaterThan(0.95);
    expect(spinRtp()).toBeLessThan(0.96);
  });
});
