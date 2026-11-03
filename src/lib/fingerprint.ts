// Browser-only device signals for the multi-account detector. Nothing personal leaves the phone:
// only a random device id and a SHA-256 hash of technical traits; the server hashes both again before storing.

const KEY = 'dogg-did';

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

type DeviceStorage = { getItem: (k: string, cb: (err: unknown, v?: string | null) => void) => void; setItem: (k: string, v: string, cb?: (err: unknown, ok?: boolean) => void) => void };

/** Telegram DeviceStorage (survives clearing the webview cache) when the client has it, else null. */
function tgStorage(): DeviceStorage | null {
  return (window.Telegram?.WebApp as unknown as { DeviceStorage?: DeviceStorage } | undefined)?.DeviceStorage ?? null;
}

function tgGet(ds: DeviceStorage) {
  return new Promise<string | null>(resolve => {
    const timer = setTimeout(() => resolve(null), 800);
    try { ds.getItem(KEY, (err, v) => { clearTimeout(timer); resolve(err ? null : v ?? null); }); } catch { clearTimeout(timer); resolve(null); }
  });
}

/** Random id that stays on this phone: shared by every Telegram account opened on it. */
async function deviceId() {
  const ds = tgStorage();
  let id: string | null = null;
  try { id = localStorage.getItem(KEY); } catch { /* storage blocked */ }
  if (!id && ds) id = await tgGet(ds);
  if (!id) id = crypto.randomUUID();
  try { localStorage.setItem(KEY, id); } catch { /* ignore */ }
  try { ds?.setItem(KEY, id); } catch { /* older clients */ }
  return id;
}

function canvasTrait() {
  try {
    const c = document.createElement('canvas'); c.width = 220; c.height = 40;
    const g = c.getContext('2d'); if (!g) return '';
    g.textBaseline = 'top'; g.font = "16px 'Arial'"; g.fillStyle = '#f60'; g.fillRect(100, 1, 62, 20);
    g.fillStyle = '#069'; g.fillText('$DOGG miner 420 ✓', 2, 15); g.fillStyle = 'rgba(102,204,0,0.7)'; g.fillText('$DOGG miner 420 ✓', 4, 17);
    return c.toDataURL();
  } catch { return ''; }
}

function webglTrait() {
  try {
    const gl = document.createElement('canvas').getContext('webgl') as WebGLRenderingContext | null;
    if (!gl) return '';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? `${gl.getParameter(ext.UNMASKED_VENDOR_WEBGL)}|${gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)}` : String(gl.getParameter(gl.RENDERER));
  } catch { return ''; }
}

/** Hash of stable technical traits (model, screen, GPU, fonts rendering, timezone…). Same phone → same hash. */
async function traitsHash() {
  const n = navigator as Navigator & { deviceMemory?: number };
  const tg = window.Telegram?.WebApp as unknown as { platform?: string } | undefined;
  const parts = [
    n.userAgent, n.platform, (n.languages ?? []).join(','), n.hardwareConcurrency, n.deviceMemory ?? '', n.maxTouchPoints,
    screen.width, screen.height, screen.colorDepth, window.devicePixelRatio, Intl.DateTimeFormat().resolvedOptions().timeZone,
    tg?.platform ?? '', webglTrait(), await sha256(canvasTrait()),
  ];
  return sha256(parts.join('§'));
}

let cached: Promise<{ id: string; fp: string } | null> | null = null;
/** Device signals, computed once per app open; null if the browser can't (never blocks the app). */
export function deviceSignals() {
  cached ??= (async () => {
    try { return { id: await deviceId(), fp: await traitsHash() }; } catch { return null; }
  })();
  return cached;
}
