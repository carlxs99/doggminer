// Admin broadcasts: one message (text, optional photo, optional link button) sent to every reachable player.
// The scheduled job sends one batch per run under a lease on the broadcast row and advances a telegram_id cursor,
// so a run that dies mid-way only re-sends at most its own batch and nobody gets the same broadcast twice otherwise.
type Admin = (typeof import('@/integrations/supabase/client.server'))['supabaseAdmin'];
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const GONE = /blocked by the user|user is deactivated|chat not found|bot can't initiate/i;

export type BroadcastMsg = { text: string; photo: string | null; buttonText: string | null; buttonUrl: string | null };

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const markup = (m: BroadcastMsg) => m.buttonUrl ? { reply_markup: { inline_keyboard: [[{ text: m.buttonText || 'Open', url: m.buttonUrl }]] } } : {};

async function tg(method: string, body: Record<string, unknown> | FormData) {
  const token = process.env['TELEGRAM_BOT_TOKEN'];
  if (!token) throw new Error('Falta el token del bot.');
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, body instanceof FormData
    ? { method: 'POST', body }
    : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => null) as { ok?: boolean; result?: unknown; description?: string } | null;
  if (!j?.ok) throw new Error(j?.description ?? `Telegram ${method} ${r.status}`);
  return j.result;
}

export async function sendBroadcastTo(chatId: number, m: BroadcastMsg) {
  const text = esc(m.text);
  if (m.photo) return tg('sendPhoto', { chat_id: chatId, photo: m.photo, caption: text, parse_mode: 'HTML', ...markup(m) });
  return tg('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true }, ...markup(m) });
}

/** Uploads the image once by sending the preview to the admin; Telegram's file_id is then reused for everyone. */
export async function sendPreviewWithUpload(chatId: number, m: Omit<BroadcastMsg, 'photo'>, image: { base64: string; mime: string } | null): Promise<string | null> {
  if (!image) { await sendBroadcastTo(chatId, { ...m, photo: null }); return null; }
  const bytes = Uint8Array.from(atob(image.base64), c => c.charCodeAt(0));
  const fd = new FormData();
  fd.set('chat_id', String(chatId));
  fd.set('caption', esc(m.text));
  fd.set('parse_mode', 'HTML');
  const mk = markup({ ...m, photo: null });
  if ('reply_markup' in mk) fd.set('reply_markup', JSON.stringify(mk.reply_markup));
  fd.set('photo', new Blob([bytes], { type: image.mime }), image.mime === 'image/png' ? 'image.png' : 'image.jpg');
  const res = await tg('sendPhoto', fd) as { photo?: { file_id: string }[] };
  const id = res.photo?.at(-1)?.file_id;
  if (!id) throw new Error('Telegram no devolvió la imagen.');
  return id;
}

async function deliver(chatId: number, m: BroadcastMsg): Promise<'sent' | 'gone' | 'failed'> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try { await sendBroadcastTo(chatId, m); return 'sent'; }
    catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (GONE.test(msg)) return 'gone';
      const wait = /retry after (\d+)/i.exec(msg);
      if (wait && attempt === 0 && Number(wait[1]) <= 3) { await sleep(Number(wait[1]) * 1000 + 200); continue; }
      return 'failed';
    }
  }
  return 'failed';
}

/** One batch of the oldest active broadcast: ~25 messages per second, up to `limit` players. */
export async function runBroadcast(db: Admin, limit = 600) {
  const now = new Date();
  const active = (await db.from('dogg_broadcasts').select('id').in('status', ['queued', 'sending']).order('created_at').limit(1).maybeSingle()).data;
  if (!active) return { idle: true };
  const lease = await db.from('dogg_broadcasts').update({ status: 'sending', lease_until: new Date(now.getTime() + 120_000).toISOString() })
    .eq('id', active.id).in('status', ['queued', 'sending']).lt('lease_until', now.toISOString())
    .select('id, text, photo_file_id, button_text, button_url, cursor_id, sent, failed, gone').maybeSingle();
  const b = lease.data;
  if (!b) return { busy: true };
  const m: BroadcastMsg = { text: b.text, photo: b.photo_file_id, buttonText: b.button_text, buttonUrl: b.button_url };
  const rows = (await db.from('dogg_players').select('telegram_id').gt('telegram_id', b.cursor_id)
    .is('banned_at', null).is('bot_blocked_at', null).order('telegram_id').limit(limit)).data ?? [];
  const out = { sent: 0, gone: 0, failed: 0 };
  const gone: number[] = [];
  for (let i = 0; i < rows.length; i += 25) {
    const started = Date.now();
    const wave = rows.slice(i, i + 25).map(r => Number(r.telegram_id));
    const res = await Promise.all(wave.map(id => deliver(id, m)));
    res.forEach((r, k) => { out[r]++; if (r === 'gone') gone.push(wave[k]!); });
    // Persist progress every wave so a cut-off run doesn't resend.
    await db.from('dogg_broadcasts').update({ cursor_id: wave.at(-1)!, sent: b.sent + out.sent, failed: b.failed + out.failed, gone: b.gone + out.gone }).eq('id', b.id);
    const rest = 1000 - (Date.now() - started);
    if (rest > 0 && i + 25 < rows.length) await sleep(rest);
  }
  if (gone.length) await db.from('dogg_players').update({ bot_blocked_at: new Date().toISOString() }).in('telegram_id', gone);
  const finished = rows.length < limit;
  await db.from('dogg_broadcasts').update(finished
    ? { status: 'done', finished_at: new Date().toISOString(), lease_until: '1970-01-01T00:00:00Z' }
    : { lease_until: '1970-01-01T00:00:00Z' }).eq('id', b.id).eq('status', 'sending');
  return { id: b.id, ...out, finished };
}
