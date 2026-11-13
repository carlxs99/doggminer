import { createFileRoute } from '@tanstack/react-router';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';

// Scheduled job: sends queued $DOGG withdrawals and confirms earlier sends on-chain.
export const Route = createFileRoute('/api/public/jobs/payouts')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
        const { processPayouts } = await import('@/lib/payout.server');
        // Keeps the bot chat (/start welcome) pointed at the published app.
        const { ensureWebhook } = await import('@/lib/notify.server');
        const webhook = await ensureWebhook().catch(e => { console.error('ensureWebhook', e); return null; });
        const { reconcileVerifications } = await import('@/lib/verification.server');
        await reconcileVerifications(supabaseAdmin).catch(e => console.error('verification payments', e));
        const summary = await processPayouts(supabaseAdmin, 20_000);
        return Response.json({ ok: true, webhook, ...summary });
      },
    },
  },
});
