import { describe, it, expect } from 'vitest';
import { minesMult } from '@/lib/mines';
describe('DOGG Mines multipliers', () => {
  it('no picks pays x1', () => expect(minesMult(5, 0)).toBe(1));
  it('first pick with 3 mines', () => expect(minesMult(3, 1)).toBe(1.09));
  it('first pick with 5 mines', () => expect(minesMult(5, 1)).toBe(1.2));
  it('caps at x100', () => expect(minesMult(10, 15)).toBe(100));
});
