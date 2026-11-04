// Daily bot reminder (English, like every bot chat text): what each player sees depends on their shift. Pure: shared by the job and tests.
import { MINI_APP_LINK, SHIFT_MS } from './dogg';
import { getMiner, shiftTotal } from './mining';
import type { BotMessage } from './bot-messages';

export type ReminderPlayer = { first_name: string | null; miner_id: string | null; shift_started_at: string | null; shift_accrued: number | string | null; rate_changed_at: string | null; ref_pending: number | string | null };
export type ReminderState = 'ready' | 'idle' | 'running';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const amount = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function reminderState(p: ReminderPlayer, now: number): ReminderState {
  if (!p.shift_started_at) return 'idle';
  return now - Date.parse(p.shift_started_at) >= SHIFT_MS ? 'ready' : 'running';
}

export const REMINDER_OFF = 'remind_off';
export const REMINDER_ON = 'remind_on';

export function reminderMessage(p: ReminderPlayer, now: number): BotMessage {
  const name = p.first_name?.trim() ? `, ${esc(p.first_name.trim())}` : '';
  const minerId = p.miner_id ?? 'rookie-1';
  const mined = shiftTotal({ minerId, shiftAccrued: Number(p.shift_accrued ?? 0), rateChangedAt: p.rate_changed_at, shiftStartedAt: p.shift_started_at }, now);
  const state = reminderState(p, now);
  const lines: string[] = [];
  let cta: string;
  if (state === 'ready') {
    lines.push(`🌿 <b>Harvest time${name}!</b>`, '', `Your 24h shift is done and <b>${amount(mined)} $DOGG</b> is waiting for you.`, 'Claim it now and light your next shift so your miner never sleeps 🔥');
    cta = '💰 Claim my $DOGG';
  } else if (state === 'idle') {
    lines.push(`⛏️ <b>Your miner is cooling off${name}</b>`, '', `Light today's 24h shift and stack <b>${amount(getMiner(minerId).daily)} $DOGG</b> while you chill.`, 'One tap and it keeps mining even with the app closed 🌿');
    cta = '🔥 Start my shift';
  } else {
    const left = Math.max(0, SHIFT_MS - (now - Date.parse(p.shift_started_at ?? '')));
    const h = Math.floor(left / 3600000); const m = Math.floor(left % 3600000 / 60000);
    lines.push(`🔥 <b>Your grow op is cooking${name}</b>`, '', `<b>${amount(mined)} $DOGG</b> stacked so far, ready to claim in <b>${h}h ${m}m</b>.`, 'Pop in for tasks and ads to grab some bonus $DOGG 🎯');
    cta = '⛏️ Open $DOGG MINER';
  }
  const ref = Number(p.ref_pending ?? 0);
  if (ref > 0) lines.push('', `👥 Plus <b>${amount(ref)} $DOGG</b> from your friends is waiting in <b>Friends</b>.`);
  return { text: lines.join('\n'), buttons: [[{ text: cta, url: MINI_APP_LINK }], [{ text: '🔕 Stop daily reminders', callback_data: REMINDER_OFF }]] };
}

export function remindersOffMessage(): BotMessage {
  return { text: '🔕 <b>Daily reminders off.</b>\n\nYour miner keeps working — just remember to claim every 24h. You can turn them back on anytime.', buttons: [[{ text: '🔔 Turn reminders back on', callback_data: REMINDER_ON }]] };
}

export function remindersOnMessage(): BotMessage {
  return { text: '🔔 <b>Daily reminders on.</b>\n\nWe\'ll give you a nudge once a day so you never leave $DOGG on the table 🌿', buttons: [[{ text: '⛏️ Open $DOGG MINER', url: MINI_APP_LINK }]] };
}
