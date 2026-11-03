// Raw TON address ("0:abc…") → user-friendly non-bounceable form ("UQ…"), without @ton/core (keeps Buffer out of the browser).

function crc16(bytes: Uint8Array) {
  let crc = 0;
  for (const b of bytes) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc;
}

/** Friendly address for display; returns the input unchanged if it isn't a raw address. */
export function friendlyAddress(raw: string, testnet = false) {
  const m = /^(-?\d+):([0-9a-fA-F]{64})$/.exec(raw.trim());
  if (!m) return raw;
  const bytes = new Uint8Array(36);
  bytes[0] = 0x51 | (testnet ? 0x80 : 0); // non-bounceable (wallets)
  bytes[1] = Number(m[1]) & 0xff;
  for (let i = 0; i < 32; i++) bytes[2 + i] = parseInt(m[2]!.slice(i * 2, i * 2 + 2), 16);
  const crc = crc16(bytes.subarray(0, 34));
  bytes[34] = crc >> 8; bytes[35] = crc & 0xff;
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_');
}
