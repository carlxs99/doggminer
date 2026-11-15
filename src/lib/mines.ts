/** Mirrors dogg_mines_mult: multiplier after k safe picks with m mines on 25 tiles, 4% house edge, capped at 100x. */
export function minesMult(mines: number, k: number) {
  if (k <= 0) return 1;
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (25 - i)) / (25 - mines - i);
  return Math.min(100, Math.floor(r * 0.96 * 100) / 100);
}
export const MINES_BETS = [5, 10, 25, 50, 100] as const;
export const MINES_MODES = [3, 5, 10] as const;
