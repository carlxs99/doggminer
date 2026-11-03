import { describe, expect, it } from 'vitest';
import { CAPTION_LIMIT, CHANNEL_POST_COUNT, channelPost, normalizeAiPost, sanitizeCaption, weekKey, writerPrompt } from '@/lib/channel-posts';

describe('weekly channel posts', () => {
  it('every prepared caption fits in a Telegram photo caption and has an open-app button', () => {
    for (let i = 0; i < CHANNEL_POST_COUNT; i++) {
      const p = channelPost(i, { players: 123456, withdrawn: 9876543 });
      expect(p.caption.length).toBeLessThanOrEqual(CAPTION_LIMIT);
      expect(p.buttons.flat().some(b => b.url === 'https://t.me/Doggminerbot/miner')).toBe(true);
    }
  });

  it('every week gets its own key, so a week is never posted twice', () => {
    expect(weekKey(new Date('2026-11-03T22:00:00Z'))).toBe('w0');
    expect(weekKey(new Date('2026-11-09T17:00:00Z'))).toBe('w1');
    expect(weekKey(new Date('2026-11-16T17:00:00Z'))).toBe('w2');
  });

  it('tells the writer every previous post so it never repeats one', () => {
    const p = writerPrompt({ week: 3, history: [{ title: 'Bring the homies', angle: 'referral math' }, { title: '24h shifts', angle: null }] });
    expect(p).toContain('Bring the homies');
    expect(p).toContain('referral math');
    expect(p).toContain('24h shifts');
  });

  it('keeps only bold/italic HTML and stays under the caption limit', () => {
    expect(sanitizeCaption('<b>Hi</b> <script>x</script> & **yo**')).toBe('<b>Hi</b> &lt;script&gt;x&lt;/script&gt; &amp; <b>yo</b>');
    expect(sanitizeCaption('<b>open')).toBe('open');
    expect(sanitizeCaption('line\n'.repeat(400)).length).toBeLessThanOrEqual(CAPTION_LIMIT);
  });

  it('normalizes the AI draft (headline caps, default button)', () => {
    const d = normalizeAiPost({ angle: 'a', title: 'T', caption: 'c', button_text: '', image_headline: 'stack "season"', image_subline: 'grind', image_scene: 's' });
    expect(d.image_headline).toBe('STACK SEASON');
    expect(d.button_text).toBe('⛏️ Open $DOGG MINER');
  });
});
