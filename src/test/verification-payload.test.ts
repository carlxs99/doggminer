import { expect, it } from 'vitest';
import { beginCell, Cell } from '@ton/core';
import { verificationPayload } from '@/lib/verification-payload';

const memo = 'DOGG-VERIFY-12345678-1234-1234-1234-123456789abc';

it('encodes the verification memo without needing Buffer', async () => {
  const previous = globalThis.Buffer;
  Reflect.deleteProperty(globalThis, 'Buffer');
  let payload: string;
  try {
    payload = await verificationPayload(memo);
  } finally {
    globalThis.Buffer = previous;
  }
  const body = Cell.fromBase64(payload).beginParse();
  expect(body.loadUint(32)).toBe(0);
  expect(body.loadStringTail()).toBe(memo);
});

it('matches the TON SDK encoding byte for byte', async () => {
  const expected = beginCell().storeUint(0, 32).storeStringTail(memo).endCell().toBoc().toString('base64');
  expect(await verificationPayload(memo)).toBe(expected);
});
