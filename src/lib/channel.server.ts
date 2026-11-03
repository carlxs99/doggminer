// Sends this week's post to the announcement channel at most once (claims the week's row before sending).
import { CHANNEL, channelPost, postIndexFor, weekKey, type ChannelStats } from './channel-posts';
import { botApi } from './telegram.server';

type Admin = (typeof import('@/integrations/supabase/client.server'))['supabaseAdmin'];

async function loadStats(admin: Admin): Promise<ChannelStats | undefined> {
  const players = await admin.from('dogg_players').select('telegram_id', { count: 'exact', head: true });
  const sent = await admin.from('dogg_withdrawals').select('amount').eq('status', 'sent');
  if (players.error || sent.error) return undefined;
  return { players: players.count ?? 0, withdrawn: (sent.data ?? []).reduce((t, r) => t + Number(r.amount), 0) };
}

export async function sendWeeklyChannelPost(admin: Admin, now = new Date()) {
  const key = weekKey(now);
  const index = postIndexFor(now);
  const claim = await admin.from('dogg_channel_posts').insert({ week_key: key, post_index: index, chat: CHANNEL }).select('week_key');
  if (claim.error) {
    if (claim.error.code === '23505') return { skipped: true, week: key };
    throw new Error(claim.error.message);
  }
  const post = channelPost(index, await loadStats(admin));
  const reply_markup = { inline_keyboard: post.buttons };
  try {
    let msg: { message_id: number };
    try {
      msg = await botApi('sendPhoto', { chat_id: CHANNEL, photo: post.image, caption: post.caption, parse_mode: 'HTML', reply_markup });
    } catch (e) {
      // Image unreachable (e.g. not published yet): still post the text.
      console.error('channel sendPhoto', e);
      msg = await botApi('sendMessage', { chat_id: CHANNEL, text: post.caption, parse_mode: 'HTML', reply_markup, link_preview_options: { is_disabled: true } });
    }
    await admin.from('dogg_channel_posts').update({ message_id: msg.message_id, sent_at: new Date().toISOString() }).eq('week_key', key);
    return { sent: true, week: key, index, messageId: msg.message_id };
  } catch (e) {
    // Nothing was posted: free the week so the next scheduled retry can try again.
    await admin.from('dogg_channel_posts').delete().eq('week_key', key);
    throw e;
  }
}
