import { describe, expect, it } from 'vitest';
import { pnlSeries, pnlToday } from '@/lib/pnl';

const H = 3600_000, D = 24 * H;
const now = Date.UTC(2026, 10, 3, 18, 0);
const ledger = [
  { kind: 'mining', amount: 5, at: now - 2 * H },        // today
  { kind: 'task', amount: 15, at: now - 3 * H },         // today (ad)
  { kind: 'team', amount: 100, at: now - 3 * D },        // this week
  { kind: 'mining', amount: 40, at: now - 20 * D },      // this month
  { kind: 'withdraw', amount: -1070, at: now - 1 * H },  // withdrawal: not a loss in PNL
  { kind: 'withdraw', amount: 1070, at: now - 30 * 60_000 }, // its refund: not profit
];

describe('PNL from the real ledger', () => {
  it('today counts only earnings of the last 24 h', () => { expect(pnlToday(ledger, now)).toBe(20); });
  it('each range sums only its own earnings', () => {
    expect(pnlSeries(ledger, now, '24h').gained).toBe(20);
    expect(pnlSeries(ledger, now, '7d').gained).toBe(120);
    expect(pnlSeries(ledger, now, '30d').gained).toBe(160);
  });
  it('"All" adds the earnings older than the loaded history', () => {
    expect(pnlSeries(ledger, now, 'All', 500).gained).toBe(660);
  });
  it('withdrawals and refunds never change the PNL', () => {
    expect(pnlSeries(ledger.filter(e => e.kind !== 'withdraw'), now, '7d').gained).toBe(pnlSeries(ledger, now, '7d').gained);
  });
  it('no earnings → no chart', () => { expect(pnlSeries([], now, '7d').hasData).toBe(false); });
});
