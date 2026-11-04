import { describe, expect, it } from 'vitest';
import { WITHDRAW_FEE, WITHDRAW_MIN, withdrawNeeds, withdrawNet } from '@/lib/withdraw';

describe('withdrawals', () => {
  it('withdrawing 1000 sends 930 to the wallet', () => {
    expect(withdrawNet(1000)).toBe(930);
  });
  it('withdrawing 1000 only needs 1000 in the balance (fee taken from the amount)', () => {
    expect(withdrawNeeds(1000)).toBe(1000);
  });
  it('minimum is 1000 with a 70 fee', () => {
    expect(WITHDRAW_MIN).toBe(1000);
    expect(WITHDRAW_FEE).toBe(70);
  });
});
