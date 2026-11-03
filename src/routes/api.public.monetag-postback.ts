import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

const AD_ZONE = '12183992';
const Query = z.object({
  ymid: z.string().uuid(),
  event_type: z.string().max(32).optional(),
  reward_event_type: z.string().max(32).optional(),
  estimated_price: z.string().max(32).optional(),
  telegram_id: z.string().max(32).optional(),
  zone_id: z.string().max(32).optional(),
});

/** Monetag postback: Monetag's server calls this after it confirms an ad event. The secret lives only in the
 *  postback URL stored in Monetag, so app users cannot forge it. Rewards are paid once per ymid by dogg_ad_postback. */
export const Route = createFileRoute('/api/public/monetag-postback')({
  server: { handlers: { GET: async ({ request }) => {
    const secret = process.env['MONETAG_POSTBACK_SECRET'];
    if (!secret) return new Response('not configured', { status: 503 });
    const url = new URL(request.url);
    const { createHash, timingSafeEqual } = await import('node:crypto');
    const digest = (s: string) => createHash('sha256').update(s).digest();
    if (!timingSafeEqual(digest(url.searchParams.get('secret') ?? ''), digest(secret))) return new Response('forbidden', { status: 403 });

    const raw = Object.fromEntries([...url.searchParams].filter(([, v]) => v !== '' && !/^\{.*\}$/.test(v)));
    const q = Query.safeParse(raw);
    // Malformed or foreign events are acknowledged (200) so Monetag stops retrying; they never pay.
    if (!q.success) return new Response('ignored');
    if (q.data.zone_id && q.data.zone_id !== AD_ZONE) return new Response('ignored');
    const tg = q.data.telegram_id && /^\d+$/.test(q.data.telegram_id) ? Number(q.data.telegram_id) : null;
    const price = q.data.estimated_price && Number.isFinite(Number(q.data.estimated_price)) ? Number(q.data.estimated_price) : null;

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const r = await supabaseAdmin.rpc('dogg_ad_postback', {
      p_ymid: q.data.ymid, p_event: q.data.event_type ?? null, p_reward: q.data.reward_event_type ?? null, p_price: price, p_telegram_id: tg,
    } as { p_ymid: string; p_event: string; p_reward: string; p_price: number; p_telegram_id: number }); // nulls are allowed by the SQL function
    // A database error returns 500 so Monetag retries later; the row lock + status make retries safe.
    if (r.error) { console.error('monetag postback', r.error.message); return new Response('retry', { status: 500 }); }
    return new Response(String(r.data));
  } } },
});
