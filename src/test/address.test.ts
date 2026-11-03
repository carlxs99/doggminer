import { describe, expect, it } from 'vitest';
import { friendlyAddress } from '@/lib/address';

describe('saved wallet shown in friendly form', () => {
  it('converts the raw linked address to the UQ… form wallets show', () => {
    // Same wallet as toncenter's address book reports for this raw address.
    expect(friendlyAddress('0:8c0638100b360184bfce6d29b0d20745cac4109f9417b7c9b09b0daf1140cf4b')).toBe('UQCMBjgQCzYBhL_ObSmw0gdFysQQn5QXt8mwmw2vEUDPSwuA');
  });
  it('leaves anything else untouched', () => {
    expect(friendlyAddress('UQabc')).toBe('UQabc');
  });
});
