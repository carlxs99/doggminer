// DeDust liquidity check (server only): how much GRAM/TON a wallet has in the $DOGG pool.
// The pool keeps one position contract per owner; its data holds the owner's LP amount (first coins field after pool + owner).
import { Address, beginCell, Cell } from '@ton/core';
import { LP_POOL } from './lp';

const TC = 'https://toncenter.com/api/v3';
const headers = () => { const k = process.env['TONCENTER_API_KEY']; return { 'content-type': 'application/json', ...(k ? { 'X-API-Key': k } : {}) }; };
type Item = { type: string; value: string };

async function getMethod(address: string, method: string, stack: Item[]) {
  const r = await fetch(`${TC}/runGetMethod`, { method: 'POST', headers: headers(), body: JSON.stringify({ address, method, stack }) });
  if (!r.ok) throw new Error(`toncenter ${r.status}`);
  const j = await r.json() as { exit_code?: number; stack?: Item[] };
  if (j.exit_code !== 0 || !j.stack) throw new Error(`${method} exit ${j.exit_code}`);
  return j.stack;
}

/** GRAM side (in TON) of the wallet's DeDust liquidity in the $DOGG pool; 0 when it has none. */
export async function lpTon(wallet: string): Promise<number> {
  const slice = beginCell().storeAddress(Address.parse(wallet)).endCell().toBoc().toString('base64');
  const [posStack, poolStack] = await Promise.all([
    getMethod(LP_POOL, 'get_position_address', [{ type: 'slice', value: slice }]),
    getMethod(LP_POOL, 'get_pool_data', []),
  ]);
  const position = Cell.fromBase64(posStack[0]!.value).beginParse().loadAddress().toRawString();
  const acc = await fetch(`${TC}/account?address=${encodeURIComponent(position)}`, { headers: headers() });
  if (acc.status === 404) return 0;
  if (!acc.ok) throw new Error(`toncenter ${acc.status}`);
  const a = await acc.json() as { status?: string; data?: string | null };
  if (a.status !== 'active' || !a.data) return 0;
  const s = Cell.fromBase64(a.data).beginParse();
  s.loadAddress(); s.loadAddress();
  const lp = s.loadCoins();
  // get_pool_data: [9] = $DOGG reserve, [10] = GRAM reserve, [11] = LP total supply.
  const gram = BigInt(poolStack[10]!.value); const total = BigInt(poolStack[11]!.value);
  if (total <= 0n) return 0;
  return Number(lp * gram / total) / 1e9;
}
