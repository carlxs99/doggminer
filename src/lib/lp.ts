/** LP staking rules (mirrors public.dogg_shift / dogg_withdraw): DeDust $DOGG/GRAM liquidity with at least LP_MIN_TON on the GRAM side
 *  earns LP_APY per year on the position value (both sides, in $DOGG) and withdraws with no fee. */
export const LP_POOL = 'EQCE1PfW1mbO01NJlFSeldzUv7c6lsI2e_ZJowNTCEcrzye4';
export const LP_MIN_TON = 2;
export const LP_APY = 0.6;
export const LP_URL = `https://dedust.io/pools/${LP_POOL}`;
/** Daily $DOGG for a position worth `valueDogg` $DOGG (both sides counted). */
export const lpDailyFor = (valueDogg: number) => Math.round(Math.max(0, valueDogg) * LP_APY / 365 * 10000) / 10000;
/** Daily rate the server pays: the miner's own rate, or the LP staking rate if the player is an LP partner and that is higher. */
export const effectiveDaily = (daily: number, lpActive?: boolean, lpDaily = 0) => lpActive ? Math.max(daily, lpDaily) : daily;
