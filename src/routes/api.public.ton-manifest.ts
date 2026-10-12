import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/api/public/ton-manifest')({
  server: { handlers: { GET: ({ request }) => {
    const origin = new URL(request.url).origin;
    return Response.json({ url: origin, name: 'DOGG HOUSE', iconUrl: `${origin}/dogg-icon.png` }, { headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=300' } });
  } } },
});