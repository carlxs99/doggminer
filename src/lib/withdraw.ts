/** Withdrawal rules (mirrors public.dogg_withdraw): the fee comes out of the amount withdrawn. */
export const WITHDRAW_MIN = 1000;
export const WITHDRAW_FEE = 70;

/** What actually reaches the wallet when `amount` leaves the app balance. */
export function withdrawNet(amount: number): number {
  return Math.max(0, Math.floor(amount) - WITHDRAW_FEE);
}

/** Balance needed to withdraw `amount` (the fee is already inside it). */
export function withdrawNeeds(amount: number): number {
  return Math.floor(amount);
}
