// PNL from the real earnings ledger: only earnings count (mining, ads, tasks, referrals, bonuses);
// withdrawals and their refunds move the balance but are not profit.

export type LedgerEntry = { kind: string; amount: number; at: number };
export const PNL_RANGES = { '24h': 864e5, '7d': 7 * 864e5, '30d': 30 * 864e5, All: Infinity } as const;
export type PnlRange = keyof typeof PNL_RANGES;

const isGain = (e: LedgerEntry) => e.amount > 0 && e.kind !== 'withdraw';

/** Earnings in the last 24 hours ("PNL de hoy"). */
export function pnlToday(entries: LedgerEntry[], now: number) {
  return entries.filter(e => isGain(e) && e.at >= now - 864e5 && e.at <= now).reduce((a, e) => a + e.amount, 0);
}

/** Earnings inside the range and the chart line (x 0–100, y 2–38 in a 0 0 100 40 box, higher = more earned).
 *  earnedBefore = earnings older than the loaded entries (only matters for "All"). */
export function pnlSeries(entries: LedgerEntry[], now: number, range: PnlRange, earnedBefore = 0) {
  const gains = entries.filter(e => isGain(e) && e.at <= now).sort((a, b) => a.at - b.at);
  const all = range === 'All';
  const from = all ? (gains[0]?.at ?? now - 864e5) : now - PNL_RANGES[range];
  const inRange = gains.filter(e => e.at >= from);
  let acc = all ? earnedBefore : 0;
  const pts: [number, number][] = [[from, acc]];
  for (const e of inRange) { pts.push([e.at, acc]); acc += e.amount; pts.push([e.at, acc]); }
  pts.push([now, acc]);
  const gained = acc - (all ? 0 : 0);
  const span = Math.max(1, now - from);
  const top = Math.max(acc, 1e-9);
  const line = pts.map(([t, v]) => `${(((t - from) / span) * 100).toFixed(2)},${(38 - (v / top) * 36).toFixed(2)}`).join(' ');
  return { gained, line, hasData: acc > 0 };
}
