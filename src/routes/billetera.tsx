import { createFileRoute, redirect } from '@tanstack/react-router';
export const Route = createFileRoute('/billetera')({ beforeLoad: () => { throw redirect({ to: '/perfil', replace: true }); } });
