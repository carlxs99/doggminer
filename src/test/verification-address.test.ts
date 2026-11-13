import { expect, it } from 'vitest';
import { toUserFriendlyAddress } from '@tonconnect/sdk';
import { Address } from '@ton/core';
import { friendlyAddress } from '@/lib/address';

it('gives TON Connect a user-friendly recipient address it accepts', () => {
  const raw = '0:' + 'ab'.repeat(32);
  const friendly = friendlyAddress(raw);
  expect(friendly).toBe(toUserFriendlyAddress(raw));
  expect(Address.isFriendly(friendly)).toBe(true);
  expect(Address.parse(friendly).toRawString()).toBe(raw);
});
