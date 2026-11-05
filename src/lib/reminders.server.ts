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
      if (wait && attempt === 0) { await sleep(Math.min(30, Number(wait[1])) * 1000 + 200); continue; }
      console.warn('reminder not delivered', chatId, msg);
      return 'failed';
    }
  }
  return 'failed';
}

export async function runReminders(admin: Admin, limit = 40) {
  const { data, error } = await admin.rpc('dogg_claim_reminders', { p_limit: limit });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as (ReminderPlayer & { telegram_id: number })[];
  const out = { claimed: rows.length, sent: 0, gone: 0, failed: 0 };
  const now = Date.now();
  for (const row of rows) {
    const r = await send(Number(row.telegram_id), row, now);
    out[r]++;
    // Blocked the bot (or never opened it): stop messaging them until they /start again.
    if (r === 'gone') await admin.from('dogg_players').update({ bot_blocked_at: new Date().toISOString() }).eq('telegram_id', row.telegram_id);
    await sleep(50); // well under Telegram's ~30 messages/second
  }
  return out;
}

export async function setReminders(admin: Admin, telegramId: number, on: boolean) {
  await admin.from('dogg_players').update({ reminders_off: !on }).eq('telegram_id', telegramId);
}

/** A player who writes to the bot again can obviously receive messages. */
export async function clearBlocked(admin: Admin, telegramId: number) {
  await admin.from('dogg_players').update({ bot_blocked_at: null }).eq('telegram_id', telegramId).not('bot_blocked_at', 'is', null);
}
