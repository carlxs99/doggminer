import { createFileRoute } from '@tanstack/react-router';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';

type Background = (task: Promise<unknown>) => void;

/** The scheduler hangs up after ~5 s, so long AI steps continue after the reply when the runtime allows it. */
async function backgroundRunner(request: Request): Promise<Background | null> {
  const r = request as unknown as { waitUntil?: Background; runtime?: { cloudflare?: { context?: { waitUntil?: Background } } } };
  if (typeof r.waitUntil === 'function') return r.waitUntil.bind(r);
  const ctx = r.runtime?.cloudflare?.context;
  if (typeof ctx?.waitUntil === 'function') return ctx.waitUntil.bind(ctx);
  try {
    const mod = await import(/* @vite-ignore */ 'cloudflare:workers' as string) as { waitUntil?: Background };
    if (typeof mod.waitUntil === 'function') return mod.waitUntil;
  } catch { /* not on Workers (local dev) */ }
  return null;
}

// Scheduled job (Mondays): advances this week's brand-new channel post by one step: write → draw + send.
export const Route = createFileRoute('/api/public/jobs/channel-post')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
        const { claimChannelStep, runChannelStep } = await import('@/lib/channel.server');
        const claim = await claimChannelStep(supabaseAdmin);
        if ('skip' in claim) return Response.json({ ok: true, skip: claim.skip });
        const task = runChannelStep(supabaseAdmin, claim.row);
        const background = await backgroundRunner(request);
        if (background) { background(task); return Response.json({ ok: true, started: claim.row.status }); }
        await task;
        return Response.json({ ok: true, done: claim.row.status });
      },
    },
  },
});
