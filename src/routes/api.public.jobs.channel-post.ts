import { createFileRoute } from '@tanstack/react-router';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';

// Scheduled job: posts this week's $DOGG MINER update (image + open-app button) to the announcement channel.
export const Route = createFileRoute('/api/public/jobs/channel-post')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
        const { sendWeeklyChannelPost } = await import('@/lib/channel.server');
        try {
          return Response.json({ ok: true, ...(await sendWeeklyChannelPost(supabaseAdmin)) });
        } catch (e) {
          const error = e instanceof Error ? e.message : String(e);
          console.error('channel-post', error);
          return Response.json({ ok: false, error }, { status: 502 });
        }
      },
    },
  },
});
