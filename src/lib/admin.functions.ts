import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { chatFromUrl, normalizeTelegramUrl } from './tasks';

const Init = z.object({ initData: z.string().min(1).max(10000) });

/** Every admin call: signed Telegram user + listed in dogg_admins. Returns the admin id and the admin DB client. */
async function requireAdmin(initData: string) {
  const { verifyTelegramUser, isAdmin } = await import('./telegram.server');
  const { id } = await verifyTelegramUser(initData);
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  if (!await isAdmin(supabaseAdmin, id)) throw new Error('No autorizado');
  return { adminId: id, db: supabaseAdmin };
}
type Db = Awaited<ReturnType<typeof requireAdmin>>['db'];
const log = (db: Db, adminId: number, action: string, details: Record<string, unknown>) => db.from('dogg_admin_log').insert({ admin_id: adminId, action, details: details as never });

export const adminOverview = createServerFn({ method: 'POST' })
  .inputValidator(Init)
  .handler(async ({ data }) => {
    const { db } = await requireAdmin(data.initData);
    const s = await db.rpc('dogg_admin_stats');
    if (s.error) throw new Error(s.error.message);
    const { payoutStatus } = await import('./payout.server');
    const wallet = await payoutStatus().then(w => ({ ...w, error: null as string | null })).catch(e => ({ error: e instanceof Error ? e.message : String(e) }));
    const logRows = (await db.from('dogg_admin_log').select('action, details, created_at').order('created_at', { ascending: false }).limit(10)).data ?? [];
    return { stats: s.data as Record<string, number>, wallet: JSON.parse(JSON.stringify(wallet)) as Record<string, string | number | boolean | null>, log: logRows.map(l => ({ action: l.action, details: JSON.stringify(l.details ?? {}), at: l.created_at })) };
  });

// ---------- Tasks ----------
const TaskRow = z.object({ id: z.string(), kind: z.enum(['channel', 'group', 'bot']), title: z.string(), description: z.string().nullable(), url: z.string(), chat_id: z.string().nullable(), reward: z.coerce.number(), active: z.boolean(), sort: z.number(), claims: z.number(), created_at: z.string() });
export type AdminTask = z.infer<typeof TaskRow>;

export const adminTasks = createServerFn({ method: 'POST' })
  .inputValidator(Init)
  .handler(async ({ data }) => {
    const { db } = await requireAdmin(data.initData);
    const r = await db.from('dogg_tasks').select('id, kind, title, description, url, chat_id, reward, active, sort, claims, created_at').order('sort').order('created_at', { ascending: false });
    if (r.error) throw new Error(r.error.message);
    return r.data.map(t => TaskRow.parse(t));
  });

export const adminSaveTask = createServerFn({ method: 'POST' })
  .inputValidator(Init.extend({
    id: z.string().uuid().optional(),
    kind: z.enum(['channel', 'group', 'bot']),
    title: z.string().trim().min(2).max(80),
    description: z.string().trim().max(160).optional(),
    url: z.string().trim().min(2).max(300),
    chatId: z.string().trim().max(64).optional(),
    reward: z.number().positive().max(100000),
    sort: z.number().int().min(-1000).max(1000).default(0),
    active: z.boolean().default(true),
  }))
  .handler(async ({ data }) => {
    const { adminId, db } = await requireAdmin(data.initData);
    const url = normalizeTelegramUrl(data.url);
    if (!url) throw new Error('El enlace debe ser de Telegram (t.me/… o @usuario).');
    let chatId: string | null = null;
    if (data.kind !== 'bot') {
      const { botApi } = await import('./telegram.server');
      const target = data.chatId?.trim() || chatFromUrl(url);
      if (!target) throw new Error('Para un enlace privado (t.me/+…), escribe también el ID del chat (empieza por -100).');
      // The bot must be inside (admin for channels) or it can't check who joined.
      const chat = await botApi<{ id: number; type: string; title?: string }>('getChat', { chat_id: target }).catch(() => { throw new Error('El bot no encuentra ese canal o grupo. Añádelo como admin y revisa el enlace o el ID.'); });
      const me = await botApi<{ id: number }>('getMe', {});
      const role = await botApi<{ status: string }>('getChatMember', { chat_id: chat.id, user_id: me.id }).catch(() => ({ status: 'left' }));
      if (role.status !== 'administrator' && role.status !== 'creator') throw new Error('El bot tiene que ser administrador de ese canal o grupo para verificar a los usuarios.');
      if (data.kind === 'channel' && chat.type !== 'channel') throw new Error('Ese chat es un grupo, no un canal. Elige «Grupo».');
      if (data.kind === 'group' && chat.type === 'channel') throw new Error('Ese chat es un canal, no un grupo. Elige «Canal».');
      chatId = String(chat.id);
    } else if (!/^https:\/\/t\.me\/[A-Za-z0-9_]{4,32}bot(\?.*)?$/i.test(url)) {
      throw new Error('El enlace de un bot debe ser t.me/NombreBot (termina en «bot»).');
    }
    const row = { kind: data.kind, title: data.title, description: data.description || null, url, chat_id: chatId, reward: data.reward, sort: data.sort, active: data.active, updated_at: new Date().toISOString() };
    const r = data.id
      ? await db.from('dogg_tasks').update(row).eq('id', data.id).select('id').single()
      : await db.from('dogg_tasks').insert({ ...row, created_by: adminId }).select('id').single();
    if (r.error) throw new Error(r.error.message);
    await log(db, adminId, data.id ? 'task_edit' : 'task_create', { id: r.data.id, title: data.title, reward: data.reward, kind: data.kind });
    return { id: r.data.id };
  });

export const adminTaskAction = createServerFn({ method: 'POST' })
  .inputValidator(Init.extend({ id: z.string().uuid(), action: z.enum(['activate', 'pause', 'delete']) }))
  .handler(async ({ data }) => {
    const { adminId, db } = await requireAdmin(data.initData);
    const r = data.action === 'delete'
      ? await db.from('dogg_tasks').delete().eq('id', data.id)
      : await db.from('dogg_tasks').update({ active: data.action === 'activate', updated_at: new Date().toISOString() }).eq('id', data.id);
    if (r.error) throw new Error(r.error.message);
    await log(db, adminId, `task_${data.action}`, { id: data.id });
    return { ok: true };
  });

// ---------- Users ----------
const UserRow = z.object({ telegram_id: z.coerce.number(), first_name: z.string().nullable(), username: z.string().nullable(), balance: z.coerce.number(), miner_id: z.string(), claimed_shifts: z.number(), shift_started_at: z.string().nullable(), wallet_address: z.string().nullable(), last_hold: z.coerce.number().nullable(), withdraw_verified_at: z.string().nullable(), referred_by: z.coerce.number().nullable(), ref_pending: z.coerce.number(), ref_earned: z.coerce.number(), created_at: z.string() });
export type AdminUser = z.infer<typeof UserRow>;
const USER_COLS = 'telegram_id, first_name, username, balance, miner_id, claimed_shifts, shift_started_at, wallet_address, last_hold, withdraw_verified_at, referred_by, ref_pending, ref_earned, created_at';

export const adminUsers = createServerFn({ method: 'POST' })
  .inputValidator(Init.extend({ q: z.string().trim().max(64).default(''), sort: z.enum(['recent', 'balance']).default('recent') }))
  .handler(async ({ data }) => {
    const { db } = await requireAdmin(data.initData);
    let query = db.from('dogg_players').select(USER_COLS);
    const q = data.q.replace(/^@/, '');
    if (/^\d{3,15}$/.test(q)) query = query.eq('telegram_id', Number(q));
    else if (q) { const safe = q.replace(/[%_,()]/g, ''); query = query.or(`username.ilike.%${safe}%,first_name.ilike.%${safe}%`); }
    const r = await query.order(data.sort === 'balance' ? 'balance' : 'created_at', { ascending: false }).limit(40);
    if (r.error) throw new Error(r.error.message);
    return r.data.map(u => UserRow.parse(u));
  });

export const adminAdjust = createServerFn({ method: 'POST' })
  .inputValidator(Init.extend({ telegramId: z.number().int().positive(), delta: z.number().refine(n => n !== 0 && Math.abs(n) <= 10_000_000), reason: z.string().trim().min(2).max(200) }))
  .handler(async ({ data }) => {
    const { adminId, db } = await requireAdmin(data.initData);
    const r = await db.rpc('dogg_admin_adjust', { p_admin: adminId, p_telegram_id: data.telegramId, p_delta: data.delta, p_reason: data.reason });
    if (r.error) throw new Error(r.error.message);
    return { balance: Number(r.data) };
  });

// ---------- Withdrawals ----------
const WdRow = z.object({ id: z.string(), telegram_id: z.coerce.number(), amount: z.coerce.number(), fee: z.coerce.number(), address: z.string(), status: z.string(), error: z.string().nullable(), tx_hash: z.string().nullable(), created_at: z.string(), sent_at: z.string().nullable(), attempts: z.number() });
export type AdminWithdrawal = z.infer<typeof WdRow>;

export const adminWithdrawals = createServerFn({ method: 'POST' })
  .inputValidator(Init.extend({ status: z.enum(['all', 'pending', 'sending', 'sent', 'failed']).default('all') }))
  .handler(async ({ data }) => {
    const { db } = await requireAdmin(data.initData);
    let q = db.from('dogg_withdrawals').select('id, telegram_id, amount, fee, address, status, error, tx_hash, created_at, sent_at, attempts');
    if (data.status !== 'all') q = q.eq('status', data.status);
    const r = await q.order('created_at', { ascending: false }).limit(50);
    if (r.error) throw new Error(r.error.message);
    return r.data.map(w => WdRow.parse(w));
  });

/** Manual decisions for withdrawals the robot couldn't confirm, plus "send the queue now". */
export const adminWithdrawalAction = createServerFn({ method: 'POST' })
  .inputValidator(Init.extend({ action: z.enum(['run', 'refund', 'mark_sent']), id: z.string().uuid().optional(), txHash: z.string().trim().max(120).optional() }))
  .handler(async ({ data }) => {
    const { adminId, db } = await requireAdmin(data.initData);
    if (data.action === 'run') {
      const { processPayouts } = await import('./payout.server');
      const summary = await processPayouts(db, 30_000);
      await log(db, adminId, 'payout_run', summary);
      return { ok: true, summary: JSON.stringify(summary) };
    }
    if (!data.id) throw new Error('Falta el retiro');
    const w = await db.from('dogg_withdrawals').select('status').eq('id', data.id).single();
    if (w.error) throw new Error(w.error.message);
    if (!['pending', 'sending'].includes(w.data.status)) throw new Error('Este retiro ya está cerrado.');
    if (data.action === 'refund') {
      const r = await db.rpc('dogg_withdraw_fail', { p_id: data.id, p_error: 'Devuelto por el admin' });
      if (r.error) throw new Error(r.error.message);
    } else {
      const r = await db.from('dogg_withdrawals').update({ status: 'sent', sent_at: new Date().toISOString(), tx_hash: data.txHash || null, error: 'Marcado como enviado por el admin' }).eq('id', data.id).in('status', ['pending', 'sending']);
      if (r.error) throw new Error(r.error.message);
    }
    await log(db, adminId, `withdraw_${data.action}`, { id: data.id, txHash: data.txHash ?? null });
    return { ok: true, summary: '' };
  });
