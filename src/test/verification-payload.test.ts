import { expect, it } from 'vitest';
import { verificationPayload } from '@/lib/verification-payload';

it('encodes the exact verification memo when the browser has no Buffer', async () => {
  const previous = globalThis.Buffer;
  Reflect.deleteProperty(globalThis, 'Buffer');
  const memo = 'DOGG-VERIFY-12345678-1234-1234-1234-123456789abc';
  try {
    const payload = await verificationPayload(memo);
    expect(globalThis.Buffer.alloc(4).length).toBe(4);
    const { Cell } = await import('@ton/core');
    const body = Cell.fromBase64(payload).beginParse();
    expect(body?.loadUint(32)).toBe(0);
    expect(body?.loadStringTail()).toBe(memo);
  } finally {
    globalThis.Buffer = previous;
  }
});