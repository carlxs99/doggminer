// Weekly channel post, one step per scheduled run: write (AI text) → draw + send (AI image).
// A per-week row with a short lease keeps runs single-flight and the week posted at most once.
import type { Database } from '@/integrations/supabase/types';
import { CHANNEL, CHANNEL_POST_COUNT, aiPostButtons, channelPost, weekKey, weekNumber, type ChannelStats } from './channel-posts';

type Admin = (typeof import('@/integrations/supabase/client.server'))['supabaseAdmin'];
type Row = Database['public']['Tables']['dogg_channel_posts']['Row'];

const LEASE_MS = 4 * 60_000;
/** Retryable failures per step before giving up on AI for that step. */
const MAX_TRIES = 4;
const TABLE = 'dogg_channel_posts';

async function loadStats(admin: Admin): Promise<ChannelStats | undefined> {
  const players = await admin.from('dogg_players').select('telegram_id', { count: 'exact', head: true });
  const sent = await admin.from('dogg_withdrawals').select('amount').eq('status', 'sent');
  if (players.error || sent.error) return undefined;
  return { players: players.count ?? 0, withdrawn: (sent.data ?? []).reduce((t, r) => t + Number(r.amount), 0) };
}

/** Claims this week's next step, or says why there is nothing to do. */
export async function claimChannelStep(admin: Admin, now = new Date()): Promise<{ row: Row } | { skip: string }> {
  const key = weekKey(now);
  const lease = new Date(now.getTime() + LEASE_MS).toISOString();
  let row = (await admin.from(TABLE).select('*').eq('week_key', key).maybeSingle()).data;
  if (!row) {
    const ins = await admin.from(TABLE).insert({ week_key: key, chat: CHANNEL, status: 'writing', kind: 'ai', attempts: 1, lease_until: lease }).select('*').single();
    if (!ins.error) return { row: ins.data };
    if (ins.error.code !== '23505') throw new Error(ins.error.message);
    row = (await admin.from(TABLE).select('*').eq('week_key', key).maybeSingle()).data;
    if (!row) return { skip: 'busy' };
  }
  if (row.status !== 'writing' && row.status !== 'drawing') return { skip: row.status };
  if (row.lease_until && new Date(row.lease_until) > now) return { skip: 'busy' };
  const upd = await admin.from(TABLE).update({ lease_until: lease, attempts: row.attempts + 1, updated_at: now.toISOString() })
    .eq('week_key', key).eq('status', row.status).eq('attempts', row.attempts).select('*');
  const claimed = upd.data?.[0];
  return claimed ? { row: claimed } : { skip: 'busy' };
}

async function tg(method: string, body: FormData | Record<string, unknown>) {
  const token = process.env['TELEGRAM_BOT_TOKEN'];
  if (!token) throw new Error('Falta el token del bot.');
  const init: RequestInit = body instanceof FormData ? { method: 'POST', body } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  // A network failure throws (outcome unknown); a Telegram refusal returns ok:false (nothing was posted).
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, init);
  return await r.json().catch(() => ({ ok: false, description: `HTTP ${r.status}` })) as { ok: boolean; result?: { message_id: number }; description?: string };
}

const update = (admin: Admin, key: string, fields: Database['public']['Tables']['dogg_channel_posts']['Update']) =>
  admin.from(TABLE).update({ ...fields, updated_at: new Date().toISOString() }).eq('week_key', key);

/** Sends the post; returns false only when Telegram clearly refused it (safe to retry). */
async function publish(admin: Admin, row: Row, post: { caption: string; buttons: { text: string; url: string }[][]; photo: Uint8Array | string | null }) {
  await update(admin, row.week_key, { status: 'sending' });
  const reply_markup = JSON.stringify({ inline_keyboard: post.buttons });
  let res: Awaited<ReturnType<typeof tg>> | null = null;
  try {
    if (post.photo) {
      const form = new FormData();
      form.set('chat_id', CHANNEL);
      if (typeof post.photo === 'string') form.set('photo', post.photo);
      else form.set('photo', new Blob([post.photo.buffer as ArrayBuffer], { type: 'image/jpeg' }), 'dogg-news.jpg');
      form.set('caption', post.caption);
      form.set('parse_mode', 'HTML');
      form.set('reply_markup', reply_markup);
      res = await tg('sendPhoto', form);
    }
    if (!res?.ok) {
      if (res) console.error('channel sendPhoto refused', res.description);
      res = await tg('sendMessage', { chat_id: CHANNEL, text: post.caption, parse_mode: 'HTML', reply_markup: JSON.parse(reply_markup), link_preview_options: { is_disabled: true } });
    }
  } catch (e) {
    // Outcome unknown: stay in 'sending' so no later run can post this week twice.
    await update(admin, row.week_key, { error: `unknown send outcome: ${e instanceof Error ? e.message : String(e)}`, lease_until: null });
    return true;
  }
  if (!res.ok) {
    await update(admin, row.week_key, { status: row.status, error: res.description ?? 'telegram refused', lease_until: null });
    return false;
  }
  await update(admin, row.week_key, { status: 'sent', message_id: res.result?.message_id ?? null, sent_at: new Date().toISOString(), error: null, lease_until: null });
  return true;
}

/** Fallback when AI can't write this week: the next prepared post never used before. */
async function sendUnusedCurated(admin: Admin, row: Row, reason: string) {
  const used = new Set(((await admin.from(TABLE).select('post_index').eq('kind', 'curated')).data ?? []).map(r => r.post_index));
  const index = Array.from({ length: CHANNEL_POST_COUNT }, (_, i) => i).find(i => !used.has(i));
  if (index === undefined) {
    await update(admin, row.week_key, { status: 'failed', error: reason, lease_until: null });
    await notifyAdmins(admin, `⚠️ El post semanal de ${CHANNEL} no se pudo crear esta semana: ${reason}`);
    return;
  }
  const post = channelPost(index);
  await update(admin, row.week_key, { kind: 'curated', post_index: index, caption: post.caption, title: `prepared post ${index + 1}`, error: reason });
  await publish(admin, { ...row, status: row.status }, { caption: post.caption, buttons: post.buttons, photo: post.image });
}

async function notifyAdmins(admin: Admin, text: string) {
  const ids = ((await admin.from('dogg_admins').select('telegram_id')).data ?? []).map(r => r.telegram_id);
  await Promise.all(ids.map(id => tg('sendMessage', { chat_id: id, text }).catch(() => null)));
}

/** Runs the claimed step. Never throws: failures release the lease for the next scheduled run. */
export async function runChannelStep(admin: Admin, row: Row, now = new Date()) {
  const apiKey = process.env['LOVABLE_API_KEY'];
  const { writeChannelPost, drawChannelImage } = await import('./channel-ai.server');
  try {
    if (row.status === 'writing') {
      if (!apiKey || row.attempts > MAX_TRIES) return await sendUnusedCurated(admin, row, apiKey ? 'too many retries writing' : 'LOVABLE_API_KEY missing');
      const history = (await admin.from(TABLE).select('title, angle').eq('status', 'sent').order('created_at', { ascending: false }).limit(60)).data ?? [];
      try {
        const d = await writeChannelPost(apiKey, { week: weekNumber(now), stats: await loadStats(admin), history });
        await update(admin, row.week_key, { status: 'drawing', attempts: 0, lease_until: null, error: null, angle: d.angle, title: d.title, caption: d.caption, button_text: d.button_text, image_headline: d.image_headline, image_subline: d.image_subline, image_scene: d.image_scene });
      } catch (e) {
        const err = e as { terminal?: boolean; message?: string };
        if (err.terminal) return await sendUnusedCurated(admin, row, `AI text: ${err.message}`);
        await update(admin, row.week_key, { lease_until: null, error: `AI text (retry): ${err.message}` });
      }
      return;
    }
    if (row.status === 'drawing' && row.caption) {
      let photo: Uint8Array | null = null;
      if (apiKey && row.attempts <= MAX_TRIES) {
        try {
          photo = await drawChannelImage(apiKey, { image_headline: row.image_headline ?? 'DOGG NEWS', image_subline: row.image_subline ?? '', image_scene: row.image_scene ?? 'the character relaxing in a neon-lit grow room' });
        } catch (e) {
          const err = e as { terminal?: boolean; message?: string };
          if (!err.terminal) { await update(admin, row.week_key, { lease_until: null, error: `AI image (retry): ${err.message}` }); return; }
          console.error('channel image terminal', err.message); // still post the new text without an image
        }
      }
      await publish(admin, row, { caption: row.caption, buttons: aiPostButtons(row.button_text), photo });
    }
  } catch (e) {
    console.error('channel step', e);
    await update(admin, row.week_key, { lease_until: null, error: e instanceof Error ? e.message : String(e) });
  }
}
