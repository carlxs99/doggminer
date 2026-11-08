import { createFileRoute } from '@tanstack/react-router';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';

type Background = (task: Promise<unknown>) => void;

async function backgroundRunner(request: Request): Promise<Background | null> {
  const r = request as unknown as { waitUntil?: Background; runtime?: { cloudflare?: { context?: { waitUntil?: Background } } } };
  if (typeof r.waitUntil === 'function') return r.waitUntil.bind(r);
  const ctx = r.runtime?.cloudflare?.context;
  if (typeof ctx?.waitUntil === 'function') return ctx.waitUntil.bind(ctx);
  try {
    const builtin = ['cloudflare', 'workers'].join(':');
    const mod = await import(/* @vite-ignore */ builtin) as { waitUntil?: Background };
    if (typeof mod.waitUntil === 'function') return mod.waitUntil;
  } catch { /* local dev */ }
  return null;
}

// Scheduled every minute: sends the next batch of the active admin broadcast.
export const Route = createFileRoute('/api/public/jobs/broadcast')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
        const { runBroadcast } = await import('@/lib/broadcast.server');
        const task = runBroadcast(supabaseAdmin).then(r => console.log('broadcast', r)).catch(e => console.error('broadcast', e));
        const background = await backgroundRunner(request);
        if (background) { background(task); return Response.json({ ok: true, started: true }); }
        await task;
        return Response.json({ ok: true, done: true });
      },
    },
  },
});
