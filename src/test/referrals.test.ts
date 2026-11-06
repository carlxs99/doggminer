import { describe, expect, it } from 'vitest';
import { parseRef, referralLink, REF_BONUS, REF_SHARE, REF_PAGE, refPages } from '@/lib/dogg';

describe('referrals', () => {
  it('builds the invite link on the @Doggminerbot/miner mini app', () => {
    expect(referralLink(12345)).toBe('https://t.me/Doggminerbot/miner?startapp=ref_12345');
  });
  it('reads the inviter id from the start param', () => {
    expect(parseRef('ref_12345')).toBe(12345);
    expect(parseRef('ref_0')).toBeNull();
    expect(parseRef('ref_abc')).toBeNull();
    expect(parseRef('promo')).toBeNull();
    expect(parseRef(null)).toBeNull();
  });
  it('pays +100 per qualified recruit and 10% of their mining', () => {
    expect(REF_BONUS).toBe(100);
    expect(REF_SHARE).toBe(0.1);
  });
  it('pages the friends list at 20 recruits per page, same formula as public.dogg_referral', () => {
    expect(REF_PAGE).toBe(20);
    expect(refPages(0)).toBe(1);
    expect(refPages(20)).toBe(1);
    expect(refPages(21)).toBe(2);
    expect(refPages(942)).toBe(48);
  });
});
