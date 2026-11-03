import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/api/public/wu-probe')({
  server: { handlers: { GET: ({ request }) => { const r = request as unknown as Record<string, unknown> & { runtime?: Record<string, unknown> }; return Response.json({ wu: typeof r['waitUntil'], runtime: Object.keys(r.runtime ?? {}) }); } } },
});
