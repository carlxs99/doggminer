import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/games.functions', () => ({ globalGameHistory: vi.fn(async () => ({ rounds: [], unavailable: false })) }));
import { gameHistoryOptions } from '@/lib/game-history-query';
import { globalGameHistory } from '@/lib/games.functions';

describe('separate global game histories', () => {
  it('keeps Mines and Spin in separate caches', () => {
    expect(gameHistoryOptions('mines').queryKey).toEqual(['global-game-history', 'mines']);
    expect(gameHistoryOptions('spin').queryKey).toEqual(['global-game-history', 'spin']);
  });
  it.each(['mines', 'spin'] as const)('requests only %s rounds from the server', async game => {
    const options = gameHistoryOptions(game);
    if (typeof options.queryFn !== 'function') throw new Error('Missing query');
    await options.queryFn({} as Parameters<typeof options.queryFn>[0]);
    expect(globalGameHistory).toHaveBeenLastCalledWith({ data: { game } });
  });
});