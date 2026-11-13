/** One-time native GRAM payment; network fees are additional. */
export const VERIFY_PAYMENT = 0.05;
export const VERIFY_NANO = '50000000';

export type VerificationTransfer = { memo: string; sender: string; recipient: string; amount: bigint; hash: string; at: number; aborted: boolean; bounced: boolean };
export function paymentMatches(t: VerificationTransfer, p: { memo: string; wallet: string; recipient: string; createdAt: number }) {
  return !t.aborted && !t.bounced && t.memo === p.memo && t.sender === p.wallet && t.recipient === p.recipient && t.amount >= BigInt(VERIFY_NANO) && t.at * 1000 >= p.createdAt;
}
