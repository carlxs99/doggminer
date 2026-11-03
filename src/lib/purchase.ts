/** Withdrawal verification: the linked wallet must have bought at least this much $DOGG on a DEX. */
export const VERIFY_BUY = 100;
/** Raw address of the $DOGG jetton master. */
export const DOGG_MASTER_RAW = '0:a74ffea7ade24751ac5b670ee0eb88243f9bf1e8bbd25d615ba16e6d62c0a92d';
/** DeDust v2 pool that trades $DOGG: on a buy, the pool sends $DOGG to the buyer. */
export const DOGG_POOLS_RAW = ['0:84d4f7d6d666ced3534994549e95dcd4bfb73a96c2367bf649a3035308472bcf'];

type Addr = { address?: string } | null | undefined;
export type TonapiAction = {
  type: string;
  status?: string;
  JettonTransfer?: { amount?: string; sender?: Addr; recipient?: Addr; jetton?: { address?: string; decimals?: number } };
  JettonSwap?: { amount_out?: string; user_wallet?: Addr; jetton_master_out?: { address?: string; decimals?: number } | null };
};
export type TonapiEvent = { event_id?: string; actions?: TonapiAction[] };

const same = (a: string | undefined, b: string) => (a ?? '').toLowerCase() === b.toLowerCase();

/** Total $DOGG (whole tokens) the wallet bought: DEX swaps into $DOGG, or $DOGG sent to it by the trading pool. */
export function purchasedDogg(events: TonapiEvent[], wallet: string) {
  let total = 0;
  const seen = new Set<string>();
  for (const e of events) {
    if (e.event_id) { if (seen.has(e.event_id)) continue; seen.add(e.event_id); }
    let bought = 0;
    for (const a of e.actions ?? []) {
      if (a.status && a.status !== 'ok') continue;
      if (a.type === 'JettonSwap' && a.JettonSwap) {
        const s = a.JettonSwap;
        if (same(s.jetton_master_out?.address, DOGG_MASTER_RAW) && same(s.user_wallet?.address, wallet)) {
          bought = Math.max(bought, Number(s.amount_out ?? '0') / 10 ** (s.jetton_master_out?.decimals ?? 9));
        }
      } else if (a.type === 'JettonTransfer' && a.JettonTransfer) {
        const t = a.JettonTransfer;
        const fromPool = DOGG_POOLS_RAW.some(p => same(t.sender?.address, p));
        const isDogg = !t.jetton?.address || same(t.jetton.address, DOGG_MASTER_RAW);
        if (fromPool && isDogg && same(t.recipient?.address, wallet)) {
          bought = Math.max(bought, Number(t.amount ?? '0') / 10 ** (t.jetton?.decimals ?? 9));
        }
      }
    }
    total += bought; // one purchase per event, even if it shows as both a swap and a transfer
  }
  return total;
}
