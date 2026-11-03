import { describe, expect, it } from 'vitest';
import { botWaitLeft, chatFromUrl, normalizeTelegramUrl, BOT_TASK_WAIT_S } from '@/lib/tasks';

describe('admin tasks', () => {
  it('bot tasks can be claimed after 10 seconds', () => {
    expect(BOT_TASK_WAIT_S).toBe(10);
    expect(botWaitLeft(0, 9_000)).toBe(1);
    expect(botWaitLeft(0, 10_000)).toBe(0);
  });
  it('accepts @name and t.me links', () => {
    expect(normalizeTelegramUrl('@doggchannel')).toBe('https://t.me/doggchannel');
    expect(normalizeTelegramUrl('t.me/DoggBot?start=x')).toBe('https://t.me/DoggBot?start=x');
    expect(normalizeTelegramUrl('https://example.com/x')).toBeNull();
  });
  it('finds the public chat to verify, but not for private invite links', () => {
    expect(chatFromUrl('https://t.me/doggchannel')).toBe('@doggchannel');
    expect(chatFromUrl('https://t.me/+AbCdEf123')).toBeNull();
    expect(chatFromUrl('https://t.me/joinchat/AbCd')).toBeNull();
  });
});

describe('daily react task', () => {
  it('reopens exactly 24 h after each claim', async () => {
    const { taskDone, taskResetAt } = await import('@/lib/tasks');
    const claimed = '2026-11-03T10:00:00.000Z';
    expect(taskResetAt('react', claimed)).toBe('2026-11-04T10:00:00.000Z');
    expect(taskDone('react', claimed, Date.parse('2026-11-04T09:59:00Z'))).toBe(true);
    expect(taskDone('react', claimed, Date.parse('2026-11-04T10:00:00Z'))).toBe(false);
  });
  it('channel, group and bot tasks stay one-time', async () => {
    const { taskDone, taskResetAt } = await import('@/lib/tasks');
    expect(taskResetAt('channel', '2026-11-03T10:00:00Z')).toBeNull();
    expect(taskDone('bot', '2026-01-01T00:00:00Z', Date.parse('2027-01-01T00:00:00Z'))).toBe(true);
  });
});
