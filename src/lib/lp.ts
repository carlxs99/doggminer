/** LP partner rules (mirrors public.dogg_shift / dogg_withdraw): DeDust $DOGG/GRAM liquidity with at least LP_MIN_TON on the GRAM side
 *  mines at least LP_DAILY $DOGG per day and withdraws with no fee. */
export const LP_POOL = 'EQCE1PfW1mbO01NJlFSeldzUv7c6lsI2e_ZJowNTCEcrzye4';
export const LP_MIN_TON = 2;
export const LP_DAILY = 50;
export const LP_URL = `https://dedust.io/pools/${LP_POOL}`;
/** Daily rate the server pays: the miner's own rate, or LP_DAILY if the player is an LP partner and that is higher. */
export const effectiveDaily = (daily: number, lpActive?: boolean) => lpActive ? Math.max(daily, LP_DAILY) : daily;
