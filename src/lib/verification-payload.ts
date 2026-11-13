// The trailing slash selects the npm browser package, not Node's built-in
// "buffer" module, which production browser bundles replace with an empty shim.
import { Buffer } from 'buffer/';

/** TON's cell encoder needs Buffer even when loaded dynamically in Telegram. */
export async function verificationPayload(memo: string): Promise<string> {
  const browser = globalThis as typeof globalThis & { Buffer?: typeof Buffer };
  browser.Buffer ??= Buffer;
  // Install the browser implementation before evaluating the TON SDK.
  const { beginCell } = await import('@ton/core');
  return beginCell().storeUint(0, 32).storeStringTail(memo).endCell().toBoc().toString('base64');
}