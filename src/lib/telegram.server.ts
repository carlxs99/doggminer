// Server-only Telegram helpers: verify Mini App initData and call the Bot API with the bot token.
import { z } from 'zod';
import { parseRef } from './dogg';

/** Verifies the signed Telegram initData and returns the user (and the signed inviter from start_param). */
export async function verifyTelegramUser(initData: string) {
  const token = process.env['TELEGRAM_BOT_TOKEN'];
  if (!token) throw new Error('El bot todavía no está configurado. El minado real no está disponible.');
  const { createHmac, timingSafeEqual } = await import('node:crypto');
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  params.delete('hash');
  const check = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const expected = createHmac('sha256', secret).update(check).digest();
  const actual = Buffer.from(hash ?? '', 'hex');
  const authDate = Number(params.get('auth_date'));
  const now = Math.floor(Date.now() / 1000);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected) || !authDate || now - authDate > 86400 || authDate > now + 30) throw new Error('Abre de nuevo la mini app desde Telegram.');
  const user = z.object({ id: z.number().int().positive(), first_name: z.string().optional(), username: z.string().optional() }).parse(JSON.parse(params.get('user') ?? '{}'));
  // start_param is signed inside initData, so the inviter id can't be forged by the client.
  return { id: user.id, firstName: user.first_name ?? null, username: user.username ?? null, referrer: parseRef(params.get('start_param')) };
}

type Admin = (typeof import('@/integrations/supabase/client.server'))['supabaseAdmin'];
export async function isAdmin(admin: Admin, telegramId: number) {
  const r = await admin.from('dogg_admins').select('telegram_id').eq('telegram_id', telegramId).maybeSingle();
  return Boolean(r.data);
}

/** Calls the Telegram Bot API; throws with Telegram's own description on failure. */
export async function botApi<T>(method: string, params: Record<string, unknown>): Promise<T> {
  const token = process.env['TELEGRAM_BOT_TOKEN'];
  if (!token) throw new Error('Falta el token del bot.');
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) });
  const j = await r.json().catch(() => null) as { ok?: boolean; result?: T; description?: string } | null;
  if (!j?.ok) throw new Error(j?.description ?? `Telegram ${method} ${r.status}`);
  return j.result as T;
}

type Member = { status: string; is_member?: boolean };
export const isMemberStatus = (m: Member) => ['creator', 'administrator', 'member'].includes(m.status) || (m.status === 'restricted' && m.is_member === true);

/** True if the user is inside the channel/group (the bot must be admin there). */
export async function isChatMember(chatId: string, userId: number) {
  try { return isMemberStatus(await botApi<Member>('getChatMember', { chat_id: chatId, user_id: userId })); }
  catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (/user not found|participant_id_invalid/i.test(msg)) return false;
    throw new Error('No se pudo comprobar tu suscripción ahora mismo. Inténtalo en un momento.');
  }
}
