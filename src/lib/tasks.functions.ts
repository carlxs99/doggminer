import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { taskDone, taskResetAt, type TaskKind } from './tasks';

const TaskOut = z.object({ id: z.string(), kind: z.enum(['channel', 'group', 'bot', 'react']), title: z.string(), description: z.string().nullable(), url: z.string(), reward: z.number(), startedAt: z.string().nullable(), claimed: z.boolean(), resetAt: z.string().nullable() });
export type PlayerTask = z.infer<typeof TaskOut>;

/** Active admin tasks, with this player's progress when opened from Telegram (demo: tasks only). */
export const listTasks = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ initData: z.string().max(10000).optional() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const userId = data.initData ? (await (await import('./telegram.server')).verifyTelegramUser(data.initData)).id : null;
    const t = await supabaseAdmin.from('dogg_tasks').select('id, kind, title, description, url, reward').eq('active', true).order('sort').order('created_at', { ascending: false }).limit(50);
    if (t.error) throw new Error(t.error.message);
    const claims = userId && t.data.length ? (await supabaseAdmin.from('dogg_task_claims').select('task_id, started_at, claimed_at').eq('telegram_id', userId).in('task_id', t.data.map(x => x.id))).data ?? [] : [];
    return t.data.map(x => {
      const c = claims.find(cl => cl.task_id === x.id);
      const kind = x.kind as TaskKind;
      const claimedAt = c?.claimed_at ?? null;
      const done = taskDone(kind, claimedAt, Date.now());
      // A daily task whose window passed shows as new again (opening it starts a fresh round).
      const fresh = Boolean(claimedAt) && !done;
      return TaskOut.parse({ ...x, reward: Number(x.reward), startedAt: fresh ? null : c?.started_at ?? null, claimed: done, resetAt: done ? taskResetAt(kind, claimedAt) : null });
    });
  });

/** Player opened a task link: the server records the time (bot tasks need 10 s from here). */
export const startTask = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ initData: z.string().min(1).max(10000), taskId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { verifyTelegramUser } = await import('./telegram.server');
    const { id } = await verifyTelegramUser(data.initData);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const r = await supabaseAdmin.rpc('dogg_task_start', { p_telegram_id: id, p_task: data.taskId });
    if (r.error) throw new Error(r.error.message);
    return { startedAt: String(r.data), serverNow: new Date().toISOString() };
  });

/** Pays a task: channels/groups only if the bot sees the player inside; bots after the 10 s wait; react tasks need both and repeat every 24 h. */
export const claimTask = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ initData: z.string().min(1).max(10000), taskId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { verifyTelegramUser, isChatMember } = await import('./telegram.server');
    const { id } = await verifyTelegramUser(data.initData);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const t = await supabaseAdmin.from('dogg_tasks').select('kind, chat_id, active').eq('id', data.taskId).maybeSingle();
    if (!t.data?.active) throw new Error('Esta tarea ya no está disponible.');
    let member = false;
    if (t.data.kind !== 'bot') {
      if (!t.data.chat_id) throw new Error('Esta tarea no está bien configurada.');
      member = await isChatMember(t.data.chat_id, id);
      if (!member) throw new Error(`Aún no te vemos en el ${t.data.kind === 'group' ? 'grupo' : 'canal'}. Únete y vuelve a verificar.`);
    }
    const r = await supabaseAdmin.rpc('dogg_task_claim', { p_telegram_id: id, p_task: data.taskId, p_member: member });
    if (r.error) throw new Error(r.error.message);
    return z.object({ balance: z.number(), reward: z.number() }).parse(r.data);
  });
