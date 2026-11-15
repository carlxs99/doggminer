import { useSuspenseQuery } from '@tanstack/react-query';
import { History, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { gameHistoryOptions } from '@/lib/game-history-query';
import { roundOutcome } from '@/lib/game-history';
import { useT } from './lang';
import bud from '@/assets/games/bud.webp';
import coin from '@/assets/dogg-coin.webp';

export function GameHistory() {
  const t = useT();
  const { data, refetch, isFetching } = useSuspenseQuery(gameHistoryOptions);
  const number = (n: number) => n.toLocaleString(t.locale, { maximumFractionDigits: 2 });
  return <section className="game-history" aria-labelledby="global-rounds-title">
    <header className="flex items-center justify-between gap-2">
      <h3 id="global-rounds-title" className="soon-title"><History /> {t('games.history')}</h3>
      <Button variant="ghost" size="icon" aria-label={t('games.historyRefresh')} title={t('games.historyRefresh')} disabled={isFetching} onClick={() => void refetch()}><RefreshCw className={isFetching ? 'animate-spin' : ''} /></Button>
    </header>
    {data.unavailable ? <p className="game-history-empty" role="status">{t('games.historyError')}</p> : data.rounds.length === 0 ? <p className="game-history-empty">{t('games.historyEmpty')}</p> : <>
      <div className="game-history-columns"><span>{t('games.historyGame')}</span><span>{t('games.historyBet')}</span><span>{t('games.historyPayout')}</span></div>
      <div className="game-history-list" tabIndex={0} aria-label={t('games.history')}>
        {data.rounds.map(round => {
          const outcome = roundOutcome(round);
          return <div className="game-history-row" key={round.id}>
            <div className="game-history-name"><img src={round.game === 'mines' ? bud : coin} alt="" width={26} height={26} loading="lazy" /><div><strong>{round.game === 'mines' ? 'DOGG Mines' : t('games.spin')}</strong><time dateTime={round.played_at}>{new Date(round.played_at).toLocaleString(t.locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time></div></div>
            <span>{number(round.bet)}<small>$DOGG</small></span>
            <span className={`game-history-result ${outcome.state}`}>{number(round.payout)}<small>x{number(outcome.multiplier)} · $DOGG</small></span>
          </div>;
        })}
      </div>
    </>}
  </section>;
}