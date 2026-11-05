import { SHIFT_MS } from './dogg';
export const MINER_TIERS = ['Rookie Rollers', 'Street Sprouts', 'Backyard Growers', 'West Coast Growers', 'Lowrider Hustlers', 'Chronic Crew', 'Gold Chain Gang', 'Smoke Kings', 'Magma OGs', 'Legendarios'] as const;
const TIER_NAMES = ['Rookie Roller', 'Street Sprout', 'Backyard Grower', 'West Coast Grower', 'Lowrider Hustler', 'Chronic Roller', 'Gold Chain', 'Smoke King', 'Magma OG', 'OG Kingpin'];
export const MINERS_PER_TIER = 50;
export type Miner = { id: string; level: number; name: string; category: string; power: number; daily: number; hold: number };
// Visible steps (must match public.dogg_miner_stats): every level adds a noticeable amount, from +0.25/day at the start to +1.20/day at level 500.
// Hold milestones are reachable by playing daily (app balance counts as hold); buying only speeds it up. Hold rises strictly every level.
export const TIER_HOLDS = [3, 150, 500, 1200, 2500, 5000, 10000, 20000, 40000, 80000, 150000];
const CURVE = 174.25 / 499 ** 2.72;
function rawDaily(i: number) { return i === 0 ? 5 : 5 + 0.25 * i + CURVE * i ** 2.72; }
function rawHold(level: number, tier: number, j: number) {
  if (level === 1) return 0;
  const r = tier === 0 ? TIER_HOLDS[0]! * (TIER_HOLDS[1]! / TIER_HOLDS[0]!) ** ((j - 1) / 49) : TIER_HOLDS[tier]! * (TIER_HOLDS[tier + 1]! / TIER_HOLDS[tier]!) ** (j / MINERS_PER_TIER);
  return Math.max(Math.round(r), level + 1);
}
export function minerAt(level: number): Miner {
  const i = level - 1; const tier = Math.floor(i / MINERS_PER_TIER); const j = i % MINERS_PER_TIER;
  const daily = Math.round(rawDaily(i) * 100) / 100;
  return { id: level === 1 ? 'rookie-1' : `miner-${level}`, level, name: `${TIER_NAMES[tier]} ${j + 1}`, category: MINER_TIERS[tier] ?? MINER_TIERS[0], power: Math.round(daily / 25 * 1000) / 1000, daily, hold: rawHold(level, tier, j) };
}
export const MINERS: Miner[] = Array.from({ length: MINER_TIERS.length * MINERS_PER_TIER }, (_, i) => minerAt(i + 1));
// Pre-catalog ids kept so existing players keep their rate.
const LEGACY: Record<string, Miner> = Object.fromEntries(([['rookie-2', 'Rookie Roller II', 6, 10], ['rookie-3', 'Rookie Roller III', 6.75, 100], ['rookie-4', 'Rookie Roller IV', 7.5, 1000], ['og-grower', 'OG Grower', 25, 10000], ['lowrider', 'Lowrider Hustler', 50, 50000], ['magma', 'Magma OG', 125, 100000], ['kingpin', 'OG Kingpin', 250, 250000]] as const).map(([id, name, daily, hold]) => [id, { id, level: 0, name, category: 'Legacy', power: daily / 25, daily, hold }]));
export const getMiner = (id: string): Miner => LEGACY[id] ?? MINERS.find(m => m.id === id) ?? minerAt(1);
export type MiningState = { minerId: string; shiftAccrued: number; rateChangedAt: string | null; shiftStartedAt: string | null; shiftBoost?: number | undefined; turboAt?: string | null | undefined };
/** Turbo 420: x2 rate for 15 minutes, once per UTC day (mirrors public.dogg_shift). */
export const TURBO_MS = 15 * 60_000;
/** Streak multiplier frozen at each shift start/claim — mirrors public.dogg_streak_boost. */
export const streakBoost = (streak: number) => streak >= 7 ? 1.15 : streak >= 3 ? 1.05 : 1;
/** Streak still alive today (a start/claim today or yesterday, UTC); otherwise the next one starts at 1. */
export function liveStreak(streak: number, lastCheckin: string | null, now: number) {
  if (!lastCheckin) return 0;
  const day = (ms: number) => Math.floor(ms / 86400000);
  return day(now) - day(Date.parse(lastCheckin)) <= 1 ? streak : 0;
}
export function shiftTotal(state: MiningState, now: number): number {
  if (!state.shiftStartedAt) return 0;
  const start = Date.parse(state.shiftStartedAt);
  const segment = state.rateChangedAt ? Date.parse(state.rateChangedAt) : start;
  const end = Math.min(now, start + SHIFT_MS);
  const from = Math.max(start, segment);
  const rate = getMiner(state.minerId).daily * (state.shiftBoost ?? 1);
  const turbo = state.turboAt ? Date.parse(state.turboAt) : NaN;
  const bonus = Number.isNaN(turbo) ? 0 : Math.max(0, Math.min(end, turbo + TURBO_MS) - Math.max(from, turbo));
  return state.shiftAccrued + (Math.max(0, end - from) + bonus) / SHIFT_MS * rate;
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
