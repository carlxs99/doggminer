/** Mirrors dogg_spin: the 20 wheel slots in order (-1 = FREE SPIN) and their hidden draw weights out of 10000. */
export const SPIN_SLOTS = [25, 0.5, 1.2, 3, 1, 10, 0, 1.5, 2, 1, 8, 0.5, 1.4, 4, -1, 5, 0, 1.8, 2.5, 1] as const;
export const SPIN_WEIGHTS = [10, 800, 600, 200, 500, 30, 1645, 600, 400, 500, 40, 800, 600, 100, 200, 80, 1645, 500, 250, 500] as const;
export const SPIN_BETS = [5, 10, 25, 50, 100] as const;
/** Expected return per spin (free spins re-spin for free). */
export function spinRtp() {
  const total = SPIN_WEIGHTS.reduce((a, b) => a + b, 0);
  let ev = 0, free = 0;
  SPIN_SLOTS.forEach((m, i) => { const p = (SPIN_WEIGHTS[i] ?? 0) / total; if (m < 0) free += p; else ev += p * m; });
  return ev / (1 - free);
}
