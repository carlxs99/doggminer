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
