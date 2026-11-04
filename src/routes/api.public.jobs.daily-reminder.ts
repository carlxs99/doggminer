import { createFileRoute } from '@tanstack/react-router';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';

type Background = (task: Promise<unknown>) => void;

/** The scheduler hangs up after ~5 s, so the batch keeps sending after the reply when the runtime allows it. */
async function backgroundRunner(request: Request): Promise<Background | null> {
  const r = request as unknown as { waitUntil?: Background; runtime?: { cloudflare?: { context?: { waitUntil?: Background } } } };
  if (typeof r.waitUntil === 'function') return r.waitUntil.bind(r);
  const ctx = r.runtime?.cloudflare?.context;
  if (typeof ctx?.waitUntil === 'function') return ctx.waitUntil.bind(ctx);
  try {
    const builtin = ['cloudflare', 'workers'].join(':');
    const mod = await import(/* @vite-ignore */ builtin) as { waitUntil?: Background };
    if (typeof mod.waitUntil === 'function') return mod.waitUntil;
  } catch { /* not on Workers (local dev) */ }
  return null;
}

// Scheduled job (daily window): each run reminds the next batch of players to claim / start their shift.
export const Route = createFileRoute('/api/public/jobs/daily-reminder')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
        const { runReminders } = await import('@/lib/reminders.server');
        const task = runReminders(supabaseAdmin).then(r => console.log('daily reminders', r)).catch(e => console.error('daily reminders', e));
        const background = await backgroundRunner(request);
        if (background) { background(task); return Response.json({ ok: true, started: true }); }
        await task;
        return Response.json({ ok: true, done: true });
      },
    },
  },
});
