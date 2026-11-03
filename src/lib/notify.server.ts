// Bot chat messages: /start webhook setup and one-time notifications (withdrawals, referrals).
// Each notification first stamps a *_notified_at column with a conditional update, so it is sent at most once.
import { APP_URL, PAYOUTS_CHANNEL, WEBHOOK_PATH, displayName, payoutChannelMessage, payoutUser, referralJoinedMessage, referralQualifiedMessage, withdrawalReturnedMessage, withdrawalSentMessage, type BotMessage } from './bot-messages';
import { botApi } from './telegram.server';

type Admin = (typeof import('@/integrations/supabase/client.server'))['supabaseAdmin'];

const markup = (m: BotMessage) => (m.buttons.length ? { reply_markup: { inline_keyboard: m.buttons } } : {});

/** Sends a message; a user who never opened the bot chat (or blocked it) just doesn't get it. */
export async function sendBotMessage(chatId: number | string, m: BotMessage) {
  try { await botApi('sendMessage', { chat_id: chatId, text: m.text, parse_mode: 'HTML', link_preview_options: { is_disabled: true }, ...markup(m) }); return true; }
  catch (e) { console.warn('bot message not delivered', chatId, e instanceof Error ? e.message : e); return false; }
}

/** Photo with caption, falling back to plain text if Telegram can't fetch the image. */
export async function sendBotPhoto(chatId: number, photo: string, m: BotMessage) {
  try { await botApi('sendPhoto', { chat_id: chatId, photo, caption: m.text, parse_mode: 'HTML', ...markup(m) }); return true; }
  catch { return sendBotMessage(chatId, m); }
}

/** Secret Telegram sends back in X-Telegram-Bot-Api-Secret-Token, derived from the bot token. */
export async function webhookSecret() {
  const token = process.env['TELEGRAM_BOT_TOKEN'];
  if (!token) throw new Error('missing bot token');
  const { createHmac } = await import('node:crypto');
  return createHmac('sha256', token).update('dogg-telegram-webhook').digest('hex').slice(0, 48);
}

/** Points the bot at the published app's webhook (idempotent; called by the scheduled job). */
export async function ensureWebhook() {
  const url = `${APP_URL}${WEBHOOK_PATH}`;
  const info = await botApi<{ url?: string }>('getWebhookInfo', {});
  if (info.url === url) return false;
  await botApi('setWebhook', { url, secret_token: await webhookSecret(), allowed_updates: ['message', 'callback_query'] });
  await botApi('setMyCommands', { commands: [
    { command: 'start', description: 'Open $DOGG MINER and start mining' },
    { command: 'invite', description: 'Get your invite link (+100 $DOGG per friend)' },
    { command: 'help', description: 'How it works' },
  ] });
  return true;
}

/** Tells the player their withdrawal was sent (or returned). Safe to call repeatedly. */
export async function notifyWithdrawal(admin: Admin, id: string) {
  try {
    const r = await admin.from('dogg_withdrawals').update({ notified_at: new Date().toISOString() })
      .eq('id', id).is('notified_at', null).in('status', ['sent', 'failed'])
      .select('telegram_id, status, amount, fee, address, tx_hash').maybeSingle();
    const w = r.data;
    if (!w) return;
    const m = w.status === 'sent'
      ? withdrawalSentMessage({ amount: Number(w.amount), address: w.address, txHash: w.tx_hash })
      : withdrawalReturnedMessage({ amount: Number(w.amount), fee: Number(w.fee) });
    await sendBotMessage(Number(w.telegram_id), m);
  } catch (e) { console.error('notifyWithdrawal', e); }
  await announcePayout(admin, id);
}

/** Posts a confirmed withdrawal to the public payouts channel, once (stamp first, then send). */
export async function announcePayout(admin: Admin, id: string) {
  try {
    const r = await admin.from('dogg_withdrawals').update({ channel_notified_at: new Date().toISOString() })
      .eq('id', id).is('channel_notified_at', null).eq('status', 'sent')
      .select('telegram_id, amount, address, tx_hash').maybeSingle();
    const w = r.data;
    if (!w) return;
    const p = (await admin.from('dogg_players').select('first_name, username').eq('telegram_id', w.telegram_id).maybeSingle()).data;
    await sendBotMessage(PAYOUTS_CHANNEL, payoutChannelMessage({ user: payoutUser(p?.first_name, p?.username), amount: Number(w.amount), address: w.address, txHash: w.tx_hash }));
  } catch (e) { console.error('announcePayout', e); }
}

/** Tells the inviter about this recruit: once when they join, once when they start mining (+100). */
export async function notifyReferral(admin: Admin, recruitId: number) {
  try {
    const now = new Date().toISOString();
    const joined = await admin.from('dogg_players').update({ ref_join_notified_at: now })
      .eq('telegram_id', recruitId).is('ref_join_notified_at', null).not('referred_by', 'is', null)
      .select('referred_by, first_name, username, referral_qualified_at').maybeSingle();
    const qualified = await admin.from('dogg_players').update({ ref_qualified_notified_at: now })
      .eq('telegram_id', recruitId).is('ref_qualified_notified_at', null).not('referral_qualified_at', 'is', null)
      .select('referred_by, first_name, username').maybeSingle();
    // Joined and qualified at once: the +100 message alone says it all.
    if (joined.data?.referred_by && !qualified.data) await sendBotMessage(Number(joined.data.referred_by), referralJoinedMessage(displayName(joined.data.first_name, joined.data.username)));
    if (qualified.data?.referred_by) await sendBotMessage(Number(qualified.data.referred_by), referralQualifiedMessage(displayName(qualified.data.first_name, qualified.data.username)));
  } catch (e) { console.error('notifyReferral', e); }
}
