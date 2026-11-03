import { createFileRoute } from '@tanstack/react-router';
import { AdminPanel } from '@/components/dogg/admin';

export const Route = createFileRoute('/admin')({
  head: () => ({ meta: [
    { title: 'Panel de admin · $DOGG MINER' },
    { name: 'description', content: 'Panel privado de administración de $DOGG MINER.' },
    { name: 'robots', content: 'noindex, nofollow' },
    { property: 'og:title', content: 'Panel de admin · $DOGG MINER' },
    { property: 'og:description', content: 'Panel privado de administración de $DOGG MINER.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary' },
  ] }),
  component: AdminPanel,
});
