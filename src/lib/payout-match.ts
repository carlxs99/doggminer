// Pure helpers for confirming $DOGG payouts on-chain (shared by the payout worker and tests).

/** A jetton transfer out of the payout wallet, as reported by an indexer. */
export type ChainTransfer = { queryId: string | null; destination: string; amount: string; aborted: boolean; hash: string; at: number };

/** Unique 63-bit query_id for a withdrawal, derived from its id, so its transfer can be found on-chain. */
export function queryIdFor(withdrawalId: string) {
  return (BigInt(`0x${withdrawalId.replace(/-/g, '').slice(0, 16)}`) & ((1n << 63n) - 1n)).toString();
}

/** Whole tokens → jetton base units without floating-point error. */
export function jettonUnits(amount: number, decimals: number) {
  const [whole, frac = ''] = amount.toFixed(Math.min(decimals, 9)).split('.');
  return BigInt(whole ?? '0') * 10n ** BigInt(decimals) + BigInt((frac + '0'.repeat(decimals)).slice(0, decimals) || '0');
}

const norm = (a: string) => a.toLowerCase();

/** Finds the payout's transfer: by its query_id, or by recipient + exact amount sent after the attempt. */
export function matchTransfer(list: ChainTransfer[], w: { queryId: string; destination: string; units: bigint; after: number }) {
  const byId = list.find(t => t.queryId === w.queryId);
  if (byId) return byId;
  return list.find(t => norm(t.destination) === norm(w.destination) && t.amount === w.units.toString() && t.at >= w.after - 120) ?? null;
}
