import { createFileRoute } from '@tanstack/react-router';
import { Juegos } from '@/components/dogg/games';
import { gameHistoryOptions } from '@/lib/game-history-query';
export const Route = createFileRoute('/juegos')({ loader: ({ context }) => context.queryClient.ensureQueryData(gameHistoryOptions), head: () => ({ meta: [{ title: 'Juegos · $DOGG MINER' }, { name: 'description', content: 'Juega DOGG Mines y Spin the Blunt y consulta las últimas jugadas globales.' }, { property: 'og:title', content: 'Juegos · $DOGG MINER' }, { property: 'og:description', content: 'DOGG Mines, Spin the Blunt y resultados globales en tiempo real.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }), component: Juegos });
