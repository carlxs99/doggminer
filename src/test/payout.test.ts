import { describe, expect, it } from 'vitest';
import { jettonUnits, matchTransfer, queryIdFor, type ChainTransfer } from '@/lib/payout-match';

const user = '0:6d66bec27a1623de654072d33782bd4c854dcaecd91d31d00a123210eabac947';
const t = (o: Partial<ChainTransfer>): ChainTransfer => ({ queryId: null, destination: user.toUpperCase(), amount: '1000000000000', aborted: false, hash: 'h', at: 2000, ...o });

describe('payout confirmation', () => {
  it('sends the exact amount in base units (9 decimals)', () => {
    expect(jettonUnits(1000, 9)).toBe(1_000_000_000_000n);
    expect(jettonUnits(1234.5, 9)).toBe(1_234_500_000_000n);
  });
  it('gives each withdrawal its own stable query id', () => {
    const a = queryIdFor('8f9b1c2d-3e4f-5a6b-7c8d-9e0f1a2b3c4d');
    expect(a).toBe(queryIdFor('8f9b1c2d-3e4f-5a6b-7c8d-9e0f1a2b3c4d'));
    expect(a).not.toBe(queryIdFor('00000000-3e4f-5a6b-7c8d-9e0f1a2b3c4d'));
    expect(BigInt(a) < 1n << 63n).toBe(true);
  });
  it('finds the transfer by query id', () => {
    expect(matchTransfer([t({ queryId: '42', hash: 'x' })], { queryId: '42', destination: '0:ff', units: 1n, after: 0 })?.hash).toBe('x');
  });
  it('falls back to recipient + exact amount after the attempt', () => {
    const w = { queryId: '1', destination: user, units: 1_000_000_000_000n, after: 2000 };
    expect(matchTransfer([t({ hash: 'ok' })], w)?.hash).toBe('ok');
    expect(matchTransfer([t({ amount: '999' })], w)).toBeNull();
    expect(matchTransfer([t({ at: 1000 })], w)).toBeNull();
  });
});
