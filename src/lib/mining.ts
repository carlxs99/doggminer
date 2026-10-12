import { SHIFT_MS } from './dogg';
export const MINERS = [
  { id: 'rookie-1', name: 'Rookie Roller I', category: 'Rookie Rollers', power: 0.2, daily: 5, hold: 0 },
  { id: 'rookie-2', name: 'Rookie Roller II', category: 'Rookie Rollers', power: 0.24, daily: 6, hold: 10 },
  { id: 'rookie-3', name: 'Rookie Roller III', category: 'Rookie Rollers', power: 0.27, daily: 6.75, hold: 100 },
  { id: 'rookie-4', name: 'Rookie Roller IV', category: 'Rookie Rollers', power: 0.3, daily: 7.5, hold: 1000 },
  { id: 'og-grower', name: 'OG Grower', category: 'West Coast Growers', power: 1, daily: 25, hold: 10000 },
  { id: 'lowrider', name: 'Lowrider Hustler', category: 'West Coast Growers', power: 2, daily: 50, hold: 50000 },
  { id: 'magma', name: 'Magma OG', category: 'Legendarios', power: 5, daily: 125, hold: 100000 },
  { id: 'kingpin', name: 'OG Kingpin', category: 'Legendarios', power: 10, daily: 250, hold: 250000 },
] as const;
export type Miner = typeof MINERS[number];
export type MiningState = { minerId: string; shiftAccrued: number; rateChangedAt: string | null; shiftStartedAt: string | null };
export const getMiner = (id: string) => MINERS.find(m => m.id === id) ?? MINERS[0];
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