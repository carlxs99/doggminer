import { describe, expect, it } from 'vitest';
import { VERIFY_PAYMENT, VERIFY_NANO, paymentMatches, type VerificationTransfer } from '@/lib/purchase';

describe('withdrawal wallet verification', () => {
  it('requires a one-time 0.1 GRAM payment', () => { expect(VERIFY_PAYMENT).toBe(0.1); expect(VERIFY_NANO).toBe('100000000'); });
  const p = { memo: 'unique', wallet: 'sender', recipient: 'bot', createdAt: 1000000 };
  const tx: VerificationTransfer = { memo: 'unique', sender: 'sender', recipient: 'bot', amount: 100000000n, hash: 'hash', at: 1001, aborted: false, bounced: false };
  it('accepts exactly 0.1 GRAM', () => expect(paymentMatches(tx, p)).toBe(true));
  it('rejects underpayments', () => expect(paymentMatches({ ...tx, amount: 99999999n }, p)).toBe(false));
  it('binds the payment to its unique reference', () => expect(paymentMatches({ ...tx, memo: 'other' }, p)).toBe(false));
  it('requires the linked wallet as sender', () => expect(paymentMatches({ ...tx, sender: 'other' }, p)).toBe(false));
  it('requires receipt by the payout wallet', () => expect(paymentMatches({ ...tx, recipient: 'other' }, p)).toBe(false));
  it('rejects failed transactions', () => expect(paymentMatches({ ...tx, aborted: true }, p)).toBe(false));
  it('rejects bounced payments', () => expect(paymentMatches({ ...tx, bounced: true }, p)).toBe(false));
  it('rejects payments before the reference existed', () => expect(paymentMatches({ ...tx, at: 999 }, p)).toBe(false));
});
