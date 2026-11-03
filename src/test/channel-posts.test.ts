import { describe, expect, it } from 'vitest';
import { CAPTION_LIMIT, CHANNEL_POST_COUNT, channelPost, postIndexFor, weekKey } from '@/lib/channel-posts';

describe('weekly channel posts', () => {
  it('every caption fits in a Telegram photo caption and has an open-app button', () => {
    for (let i = 0; i < CHANNEL_POST_COUNT; i++) {
      const p = channelPost(i, { players: 123456, withdrawn: 9876543 });
      expect(p.caption.length).toBeLessThanOrEqual(CAPTION_LIMIT);
      expect(p.buttons.flat().some(b => b.url === 'https://t.me/Doggminerbot/miner')).toBe(true);
      expect(p.image).toBe(`https://doggminer.lovable.app/channel/week-${i + 1}.jpg`);
    }
  });

  it('launch week is the intro, next Monday moves to the next post', () => {
    expect(postIndexFor(new Date('2026-11-03T22:00:00Z'))).toBe(0);
    expect(postIndexFor(new Date('2026-11-09T17:00:00Z'))).toBe(1);
    expect(weekKey(new Date('2026-11-09T17:00:00Z'))).not.toBe(weekKey(new Date('2026-11-03T22:00:00Z')));
  });

  it('starts over after the last post', () => {
    expect(postIndexFor(new Date(Date.UTC(2026, 10, 2) + CHANNEL_POST_COUNT * 7 * 86400000))).toBe(0);
  });
});
