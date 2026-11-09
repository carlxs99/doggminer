import { describe, expect, it } from 'vitest';
import { VERIFY_BUY } from '@/lib/purchase';

describe('withdrawal wallet verification', () => {
  it('requires holding at least 10000 $DOGG in the linked wallet', () => { expect(VERIFY_BUY).toBe(10000); });
});
