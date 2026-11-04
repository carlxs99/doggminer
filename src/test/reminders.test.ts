import { describe, expect, it } from 'vitest';
import { reminderMessage, reminderState, REMINDER_OFF } from '@/lib/reminders';

const H = 3600000;
const now = Date.parse('2026-11-04T18:00:00Z');
const base = { first_name: 'Carlos', miner_id: 'rookie-1', shift_accrued: 0, rate_changed_at: null, ref_pending: 0 };

describe('daily reminder', () => {
  it('a finished 24h shift asks to claim the real mined amount (5 $DOGG for the first miner)', () => {
    const p = { ...base, shift_started_at: new Date(now - 30 * H).toISOString() };
    expect(reminderState(p, now)).toBe('ready');
    expect(reminderMessage(p, now).text).toContain('5.00 $DOGG');
  });
  it('a player with no shift is asked to start one', () => {
    const p = { ...base, shift_started_at: null };
    expect(reminderState(p, now)).toBe('idle');
    expect(reminderMessage(p, now).buttons[0]?.[0]?.text).toContain('Start');
  });
  it('a running shift shows the time left', () => {
    const p = { ...base, shift_started_at: new Date(now - 18 * H).toISOString() };
    expect(reminderState(p, now)).toBe('running');
    expect(reminderMessage(p, now).text).toContain('6h 0m');
  });
  it('mentions pending referral $DOGG and always offers a way to stop reminders', () => {
    const m = reminderMessage({ ...base, shift_started_at: null, ref_pending: 100 }, now);
    expect(m.text).toContain('100.00 $DOGG');
    expect(m.buttons[1]?.[0]?.callback_data).toBe(REMINDER_OFF);
  });
});
