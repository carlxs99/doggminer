import { queryOptions } from '@tanstack/react-query';
import { globalGameHistory } from './games.functions';
import type { GlobalRound } from './game-history';

export const gameHistoryOptions = (game: GlobalRound['game']) => queryOptions({
  queryKey: ['global-game-history', game],
  queryFn: () => globalGameHistory({ data: { game } }),
  staleTime: 20_000,
  refetchInterval: 30_000,
  refetchIntervalInBackground: false,
});