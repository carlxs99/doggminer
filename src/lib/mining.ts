import { SHIFT_MS } from './dogg';
export const MINER_TIERS = ['Rookie Rollers', 'Street Sprouts', 'Backyard Growers', 'West Coast Growers', 'Lowrider Hustlers', 'Chronic Crew', 'Gold Chain Gang', 'Smoke Kings', 'Magma OGs', 'Legendarios'] as const;
const TIER_NAMES = ['Rookie Roller', 'Street Sprout', 'Backyard Grower', 'West Coast Grower', 'Lowrider Hustler', 'Chronic Roller', 'Gold Chain', 'Smoke King', 'Magma OG', 'OG Kingpin'];
export const MINERS_PER_TIER = 50;
export type Miner = { id: string; level: number; name: string; category: string; power: number; daily: number; hold: number };
// Economy curve (must match public.dogg_shift): daily = 5·1.008^(n-1), power = daily/25, hold = 10·1.0205^(n-2).
export function minerAt(level: number): Miner {
  const i = level - 1; const tier = Math.floor(i / MINERS_PER_TIER);
  const daily = Math.round(5 * 1.008 ** i * 100) / 100;
  return { id: level === 1 ? 'rookie-1' : `miner-${level}`, level, name: `${TIER_NAMES[tier]} ${i % MINERS_PER_TIER + 1}`, category: MINER_TIERS[tier] ?? MINER_TIERS[0], power: Math.round(daily / 25 * 1000) / 1000, daily, hold: i === 0 ? 0 : Math.round(10 * 1.0205 ** (i - 1)) };
}
export const MINERS: Miner[] = Array.from({ length: MINER_TIERS.length * MINERS_PER_TIER }, (_, i) => minerAt(i + 1));
// Pre-catalog ids kept so existing players keep their rate.
const LEGACY: Record<string, Miner> = Object.fromEntries(([['rookie-2', 'Rookie Roller II', 6, 10], ['rookie-3', 'Rookie Roller III', 6.75, 100], ['rookie-4', 'Rookie Roller IV', 7.5, 1000], ['og-grower', 'OG Grower', 25, 10000], ['lowrider', 'Lowrider Hustler', 50, 50000], ['magma', 'Magma OG', 125, 100000], ['kingpin', 'OG Kingpin', 250, 250000]] as const).map(([id, name, daily, hold]) => [id, { id, level: 0, name, category: 'Legacy', power: daily / 25, daily, hold }]));
export const getMiner = (id: string): Miner => LEGACY[id] ?? MINERS.find(m => m.id === id) ?? minerAt(1);
export type MiningState = { minerId: string; shiftAccrued: number; rateChangedAt: string | null; shiftStartedAt: string | null };
export function shiftTotal(state: MiningState, now: number): number {
  if (!state.shiftStartedAt) return 0;
  const start = Date.parse(state.shiftStartedAt);
  const segment = state.rateChangedAt ? Date.parse(state.rateChangedAt) : start;
  const end = Math.min(now, start + SHIFT_MS);
  return state.shiftAccrued + Math.max(0, end - Math.max(start, segment)) / SHIFT_MS * getMiner(state.minerId).daily;
}
export function switchMiner<T extends MiningState>(state: T, minerId: string, now: number): T {
  return { ...state, shiftAccrued: shiftTotal(state, now), rateChangedAt: state.shiftStartedAt ? new Date(Math.min(now, Date.parse(state.shiftStartedAt) + SHIFT_MS)).toISOString() : null, minerId };
}
/** Highest miner level a total of $DOGG (wallet hold + app balance) unlocks — mirrors public.dogg_best_miner. */
export function bestLevel(total: number): number {
  let n = 1;
  for (const m of MINERS) { if (m.hold <= total) n = m.level; else break; }
  return n;
}

/** Miner the player should auto-upgrade to (best one their wallet hold + app balance covers), or null if already there or better. */
export function autoUpgradeId(minerId: string, balance: number, hold: number): string | null {
  const best = minerAt(bestLevel(balance + hold));
  return best.daily > getMiner(minerId).daily ? best.id : null;
}
