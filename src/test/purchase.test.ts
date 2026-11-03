import { describe, expect, it } from 'vitest';
import { DOGG_MASTER_RAW, DOGG_POOLS_RAW, VERIFY_BUY, purchasedDogg, type TonapiEvent } from '@/lib/purchase';

const me = '0:1111111111111111111111111111111111111111111111111111111111111111';
const other = '0:2222222222222222222222222222222222222222222222222222222222222222';
const pool = DOGG_POOLS_RAW[0]!;
const dogg = { address: DOGG_MASTER_RAW, decimals: 9 };
const transfer = (id: string, amount: number, sender: string, recipient: string): TonapiEvent => ({ event_id: id, actions: [{ type: 'JettonTransfer', status: 'ok', JettonTransfer: { amount: String(amount * 1e9), sender: { address: sender }, recipient: { address: recipient }, jetton: dogg } }] });

describe('withdrawal purchase verification', () => {
  it('requires buying 100 $DOGG', () => { expect(VERIFY_BUY).toBe(100); });
  it('counts $DOGG the trading pool sent to the wallet', () => {
    expect(purchasedDogg([transfer('a', 60, pool, me), transfer('b', 40, pool, me)], me)).toBe(100);
  });
  it('ignores $DOGG sent by another person (not a purchase)', () => {
    expect(purchasedDogg([transfer('a', 500, other, me)], me)).toBe(0);
  });
  it('ignores sells and transfers to other wallets', () => {
    expect(purchasedDogg([transfer('a', 500, me, pool), transfer('b', 500, pool, other)], me)).toBe(0);
  });
  it('counts a DEX swap into $DOGG once, even if it also shows as a transfer', () => {
    const swap: TonapiEvent = { event_id: 's', actions: [
      { type: 'JettonSwap', status: 'ok', JettonSwap: { amount_out: String(120e9), user_wallet: { address: me }, jetton_master_out: dogg } },
      { type: 'JettonTransfer', status: 'ok', JettonTransfer: { amount: String(120e9), sender: { address: pool }, recipient: { address: me }, jetton: dogg } },
    ] };
    expect(purchasedDogg([swap, swap], me)).toBe(120);
  });
  it('ignores failed swaps', () => {
    expect(purchasedDogg([{ event_id: 'f', actions: [{ type: 'JettonSwap', status: 'failed', JettonSwap: { amount_out: String(200e9), user_wallet: { address: me }, jetton_master_out: dogg } }] }], me)).toBe(0);
  });
});
