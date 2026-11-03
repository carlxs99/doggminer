// Multi-account detector (server side): stores hashed device/network signals and alerts admins.
// Informative only — it never blocks anyone; the admin decides in the panel.
import { MINI_APP_LINK } from './dogg';
import { displayName, type BotMessage } from './bot-messages';
import { sendBotMessage } from './notify.server';

type Admin = (typeof import('@/integrations/supabase/client.server'))['supabaseAdmin'];

const REASON_ES: Record<string, string> = {
  device: '📱 mismo dispositivo', fp: '🧬 misma huella del móvil', ip: '🌐 misma red', wallet: '👛 wallet compartida', selfref: '🔁 se refirió a sí mismo',
};

export function multiAlertMessage(name: string, id: number, score: number, reasons: string[]): BotMessage {
  return {
    text: `🚨 <b>Posible multicuenta</b>\n\n${name} · <code>${id}</code>\nRiesgo: <b>${score}/100</b>\n${reasons.map(r => REASON_ES[r] ?? r).join('\n')}\n\nRevísalo en Admin → Multicuentas. No se ha bloqueado nada.`,
    buttons: [[{ text: '🛡️ Abrir el panel', url: MINI_APP_LINK }]],
  };
}

async function hmac(value: string) {
  const secret = process.env['DOGG_PROOF_SECRET'];
  if (!secret) return null;
  const { createHmac } = await import('node:crypto');
  return createHmac('sha256', secret).update(`multi:${value}`).digest('hex').slice(0, 40);
}

/** Records this visit's signals (device id, device fingerprint, network) and alerts admins the first time risk reaches 70. */
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
    const res = r.data as { score?: number; reasons?: string[]; alert?: boolean } | null;
    if (!res?.alert) return;
    const admins = (await admin.from('dogg_admins').select('telegram_id')).data ?? [];
    const msg = multiAlertMessage(displayName(who.firstName, who.username), telegramId, Number(res.score ?? 0), res.reasons ?? []);
    for (const a of admins) await sendBotMessage(Number(a.telegram_id), msg);
  } catch (e) { console.error('recordSignals', e); }
}
