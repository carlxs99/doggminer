import { createFileRoute } from "@tanstack/react-router";
import { Humero } from '@/components/dogg/screens';
export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: 'Humero · DOGG HOUSE' }, { name: 'description', content: 'Tu zona de minado DOGG: turnos de 24 horas, cosechas y cultura West Coast.' }, { property: 'og:title', content: 'Humero · DOGG HOUSE' }, { property: 'og:description', content: 'Stay high. Stack DOGG. El club de minado West Coast.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }),
  component: Humero,
});
