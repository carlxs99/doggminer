import { describe, expect, it } from 'vitest';
import { SMOKE_BETS, SMOKE_ROOM_MS, SMOKE_TURN_MS, smokePayout, smokeScore, smokeChallengeId, smokeChallengeLink, smokeRoomSchema } from '@/lib/smoke';
describe('Smoke Battle rules', () => {
  it('offers 10/25/50/100 DOGG stakes', () => expect([...SMOKE_BETS]).toEqual([10, 25, 50, 100]));
  it('pays 95% of the two-player pot', () => { expect(smokePayout(10)).toBe(19); expect(smokePayout(25)).toBe(47.5); expect(smokePayout(100)).toBe(190); });
  it('expires unaccepted rooms after 30 minutes', () => expect(SMOKE_ROOM_MS).toBe(1800000));
  it('allows the challenger 60 seconds', () => expect(SMOKE_TURN_MS).toBe(60000));
  it('rewards timing at 85%, not random draws', () => { expect(smokeScore(3400, 4000)).toBe(1000); expect(smokeScore(3200, 4000)).toBe(900); expect(smokeScore(3600, 4000)).toBe(900); expect(smokeScore(4001, 4000)).toBe(0); });
  it('round trips a Telegram challenge', () => { const id = '00000000-0000-4000-8000-000000000001'; expect(smokeChallengeId(new URL(smokeChallengeLink(id)).searchParams.get('startapp'))).toBe(id); expect(smokeChallengeId('ref_123')).toBeNull(); });
  it('strips private identity and timer fields from room DTOs', () => { const room = smokeRoomSchema.parse({ id: '00000000-0000-4000-8000-000000000001', bet: 10, status: 'open', host_name: 'Player', guest_name: null, expires_at: '2026-11-17T01:00:00Z', role: 'visitor', started: false, submitted: false, host_score: null, guest_score: null, outcome: null, payout: 0, host_id: 123, host_duration: 4200 }); expect(room).not.toHaveProperty('host_id'); expect(room).not.toHaveProperty('host_duration'); });
});