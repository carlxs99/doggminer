import { createFileRoute } from '@tanstack/react-router';
import { Amigos } from '@/components/dogg/vault';
export const Route = createFileRoute('/amigos')({ head: () => ({ meta: [{ title: 'Amigos · $DOGG MINER' }, { name: 'description', content: 'Invita a tu crew y gana $DOGG por cada recluta.' }, { property: 'og:title', content: 'Amigos · $DOGG MINER' }, { property: 'og:description', content: 'Arma tu crew en el hood y gana +100 $DOGG por recluta.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }), component: Amigos });
