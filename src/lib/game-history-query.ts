import { queryOptions } from '@tanstack/react-query';
import { globalGameHistory } from './games.functions';

export const gameHistoryOptions = queryOptions({
  queryKey: ['global-game-history'],
  queryFn: () => globalGameHistory(),
  staleTime: 20_000,
  refetchInterval: 30_000,
  refetchIntervalInBackground: false,
});