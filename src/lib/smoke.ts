import { z } from 'zod';

export const SMOKE_BETS = [10, 25, 50, 100] as const;
export const SMOKE_ROOM_MS = 30 * 60 * 1000;
export const SMOKE_TURN_MS = 60 * 1000;
export const smokePayout = (bet: number) => Math.floor(bet * 2 * 0.95 * 100) / 100;
export function smokeScore(elapsed: number, duration: number) {
  const power = elapsed / duration;
  if (power < 0 || power > 1) return 0;
  return Math.max(0, Math.round(1000 - Math.abs(power - 0.85) * 2000));
}
export const smokeRoomSchema = z.object({
  id: z.string().uuid(), bet: z.coerce.number(), status: z.enum(['preparing', 'open', 'playing', 'won', 'draw', 'cancelled']),
  host_name: z.string().nullable(), guest_name: z.string().nullable(), expires_at: z.string(),
  role: z.enum(['host', 'guest', 'visitor']), started: z.boolean(), submitted: z.boolean(),
  host_score: z.number().nullable(), guest_score: z.number().nullable(), outcome: z.enum(['win', 'loss', 'draw']).nullable(), payout: z.coerce.number(),
});
export type SmokeRoom = z.infer<typeof smokeRoomSchema>;
export const smokeResponseSchema = z.object({ balance: z.coerce.number(), rooms: z.array(smokeRoomSchema), room: smokeRoomSchema.nullable(), clock: z.object({ now: z.number(), start: z.number(), duration: z.number() }).nullable() });
export type SmokeResponse = z.infer<typeof smokeResponseSchema>;
export const smokeChallengeLink = (id: string) => `https://t.me/Doggminerbot/miner?startapp=battle_${id.replaceAll('-', '')}`;
export function smokeChallengeId(value: string | null | undefined) {
  const m = /^battle_([a-f0-9]{32})$/i.exec(value ?? '');
  if (!m) return null;
  const s = m[1];
  return s ? `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}` : null;
}