// Dependency-free BOC encoder for the verification comment. Telegram's
// production bundle has no working Buffer, so we never load @ton/core here.

function crc32c(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const b of bytes) {
    crc ^= b;
    for (let k = 0; k < 8; k++) crc = crc & 1 ? (crc >>> 1) ^ 0x82f63b78 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

/** Text-comment body (op 0 + UTF-8 memo) as a single-cell base64 BOC. */
export async function verificationPayload(memo: string): Promise<string> {
  const text = new TextEncoder().encode(memo);
  const data = new Uint8Array(4 + text.length); // first 4 bytes = op 0
  data.set(text, 4);
  if (data.length > 127) throw new Error('memo too long');
  const cell = new Uint8Array(2 + data.length);
  cell[0] = 0; // no refs, ordinary, level 0
  cell[1] = data.length * 2; // whole bytes, no completion tag
  cell.set(data, 2);
  const header = [0xb5, 0xee, 0x9c, 0x72, 0x41, 0x01, 0x01, 0x01, 0x00, cell.length, 0x00];
  const body = new Uint8Array(header.length + cell.length);
  body.set(header);
  body.set(cell, header.length);
  const crc = crc32c(body);
  const out = new Uint8Array(body.length + 4);
  out.set(body);
  out.set([crc & 0xff, (crc >>> 8) & 0xff, (crc >>> 16) & 0xff, (crc >>> 24) & 0xff], body.length);
  return toBase64(out);
}
