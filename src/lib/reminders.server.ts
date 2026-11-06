// Sends the daily reminder to the next batch of players. The DB function stamps reminder_sent_at first, so nobody gets two in a day.
import { botApi } from './telegram.server';
import { reminderMessage, type ReminderPlayer } from './reminders';

type Admin = (typeof import('@/integrations/supabase/client.server'))['supabaseAdmin'];
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const GONE = /blocked by the user|user is deactivated|chat not found|bot can't initiate/i;

async function send(chatId: number, p: ReminderPlayer, now: number): Promise<'sent' | 'gone' | 'failed'> {
  const m = reminderMessage(p, now);
  const body = { chat_id: chatId, text: m.text, parse_mode: 'HTML', link_preview_options: { is_disabled: true }, reply_markup: { inline_keyboard: m.buttons } };
  for (let attempt = 0; attempt < 2; attempt++) {
    try { await botApi('sendMessage', body); return 'sent'; }
    catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (GONE.test(msg)) return 'gone';
      const wait = /retry after (\d+)/i.exec(msg);
      if (wait && attempt === 0 && Number(wait[1]) <= 3) { await sleep(Number(wait[1]) * 1000 + 200); continue; }
      console.warn('reminder not delivered', chatId, msg);
      return 'failed';
    }
  }
  return 'failed';
}

/**
 * One run sends up to `limit` reminders in parallel waves of ~25 per second (Telegram's broadcast limit is ~30/s),
 * so a run fits the ~30 s background window and stays under the Worker's subrequest cap.
 */
export async function runReminders(admin: Admin, limit = 600) {
  const { data, error } = await admin.rpc('dogg_claim_reminders', { p_limit: limit });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as (ReminderPlayer & { telegram_id: number })[];
  const out = { claimed: rows.length, sent: 0, gone: 0, failed: 0 };
  const now = Date.now();
  const gone: number[] = [];
  for (let i = 0; i < rows.length; i += 25) {
    const started = Date.now();
    const wave = rows.slice(i, i + 25);
    const results = await Promise.all(wave.map(row => send(Number(row.telegram_id), row, now)));
    results.forEach((r, k) => { out[r]++; if (r === 'gone') gone.push(Number(wave[k]!.telegram_id)); });
    const rest = 1000 - (Date.now() - started);
    if (rest > 0 && i + 25 < rows.length) await sleep(rest);
  }
  // Blocked the bot (or never opened it): stop messaging them until they /start again.
  if (gone.length) await admin.from('dogg_players').update({ bot_blocked_at: new Date().toISOString() }).in('telegram_id', gone);
  return out;
}

export async function setReminders(admin: Admin, telegramId: number, on: boolean) {
  await admin.from('dogg_players').update({ reminders_off: !on }).eq('telegram_id', telegramId);
}

/** A player who writes to the bot again can obviously receive messages. */
export async function clearBlocked(admin: Admin, telegramId: number) {
  await admin.from('dogg_players').update({ bot_blocked_at: null }).eq('telegram_id', telegramId).not('bot_blocked_at', 'is', null);
}
