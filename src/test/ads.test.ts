import { describe, expect, it } from 'vitest';
import { AD_DAILY, AD_REWARD } from '@/lib/dogg';

describe('rewarded ad economy', () => {
  it('pays 0.5 DOGG for each rewarded ad', () => {
    expect(AD_REWARD).toBe(0.5);
  });
  it('allows 20 rewarded ads per UTC day', () => {
    expect(AD_DAILY).toBe(20);
  });
});