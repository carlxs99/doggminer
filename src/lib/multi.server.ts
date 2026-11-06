// Multi-account detector (server side): stores hashed device/network signals and runs the farm rules.
// Scores are informative only — the admin reviews them in Admin → Multicuentas; no bot alerts are sent.
// Only the farm rules in dogg_auto_ban ban automatically.
import { displayName } from './bot-messages';

type Admin = (typeof import('@/integrations/supabase/client.server'))['supabaseAdmin'];

async function hmac(value: string) {
  const secret = process.env['DOGG_PROOF_SECRET'];
  if (!secret) return null;
  const { createHmac } = await import('node:crypto');
  return createHmac('sha256', secret).update(`multi:${value}`).digest('hex').slice(0, 40);
}

/** Records this visit's signals (device id, device fingerprint, network) and applies the auto-ban farm rules. */
export async function recordSignals(admin: Admin, telegramId: number, device: { id: string; fp: string } | undefined, who: { firstName: string | null; username: string | null }) {
  try {
    const { getRequestHeader } = await import('@tanstack/react-start/server');
    const ip = (getRequestHeader('cf-connecting-ip') ?? getRequestHeader('x-forwarded-for')?.split(',')[0] ?? '').trim();
    const country = getRequestHeader('cf-ipcountry') ?? null;
    const raw: [string, string | undefined][] = [['device', device?.id], ['fp', device?.fp], ['ip', ip || undefined]];
    const signals = [];
    for (const [kind, v] of raw) { const h = v ? await hmac(v) : null; if (h) signals.push({ kind, value: h }); }
    if (!signals.length) return;
    const r = await admin.rpc('dogg_record_signals', { p_telegram_id: telegramId, p_signals: signals, p_country: country as string });
    if (r.error) { console.error('recordSignals', r.error.message); return; }
    // Auto-ban farm groups (rules in dogg_auto_ban; admins can unban in the panel).
    const b = await admin.rpc('dogg_auto_ban', { p_telegram_id: telegramId });
    if (b.error) console.error('autoBan', b.error.message);
    // Risk scores stay in the database for the admin panel; nobody is messaged about them.
    const res = r.data as { score?: number; reasons?: string[] } | null;
    if (res?.score) console.log(`multi-score ${displayName(who.firstName, who.username)} (${telegramId}): ${res.score}`, res.reasons ?? []);
  } catch (e) { console.error('recordSignals', e); }
}
