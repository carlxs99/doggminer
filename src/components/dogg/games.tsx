import { useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Bomb, Coins, Dices, Flame, Lock, Swords } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ScreenHero } from './hero';
import { useDogg } from './state';
import { useT } from './lang';
import { haptic } from '@/lib/dogg';
import { minesAction, type MinesRound } from '@/lib/games.functions';
import { minesMult, MINES_BETS, MINES_MODES } from '@/lib/mines';
import { translateServer } from '@/lib/i18n';
import bud from '@/assets/games/bud.webp';
import siren from '@/assets/games/siren.webp';
import coin from '@/assets/dogg-coin.webp';

const fmt = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 2 });
const buzz = (kind: 'success' | 'error') => window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.(kind);

function DoggMines() {
  const { demo, player, applyBalance } = useDogg();
  const t = useT();
  const call = useServerFn(minesAction);
  const [bet, setBet] = useState<number>(10);
  const [mines, setMines] = useState<3 | 5 | 10>(5);
  const [round, setRound] = useState<MinesRound | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<number | null>(null);
  const active = round?.status === 'active';
  const picks = round?.revealed?.length ?? 0;

  useEffect(() => {
    const initData = window.Telegram?.WebApp?.initData;
    if (demo || !initData) return;
    call({ data: { initData, action: 'read' } }).then(r => { if (r.status === 'active') { setRound(r); setBet(r.bet!); setMines(r.mines as 3 | 5 | 10); } }).catch(() => undefined);
  }, [demo, call]);

  async function run(action: 'start' | 'reveal' | 'cashout', tile?: number) {
    const initData = window.Telegram?.WebApp?.initData;
    if (demo || !initData) { toast.info(t('games.openTg')); return; }
    if (busy) return;
    setBusy(true); if (tile !== undefined) setPending(tile); haptic();
    try {
      const r = await call({ data: { initData, action, ...(action === 'start' ? { bet, mines } : {}), ...(tile !== undefined ? { tile } : {}) } });
      setRound(r); applyBalance(r.balance);
      if (r.status === 'lost') { buzz('error'); toast.error(t('games.busted', { n: fmt(r.bet!) })); }
      else if (r.status === 'won') { buzz('success'); toast.success(t('games.won', { n: fmt(r.payout!) })); }
      else if (action === 'reveal') buzz('success');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      toast.error(translateServer(msg) ?? t('games.error'));
    } finally { setBusy(false); setPending(null); }
  }

  const boardMines = new Set(round?.board ?? []);
  const revealed = new Set(round?.revealed ?? []);
  const cashValue = round && active ? Math.floor(round.bet! * (round.mult ?? 1) * 100) / 100 : 0;
  const nextMult = active ? (round!.next ?? minesMult(mines, picks + 1)) : minesMult(mines, 1);

  return <section className="mines-card">
    <header className="mines-head">
      <div><span className="mines-tag"><Flame /> {t('games.live')}</span><h2>DOGG MINES</h2><p>{t('games.minesDesc')}</p></div>
      <div className="mines-bal"><small>{t('games.balance')}</small><strong>{fmt(player.balance)}</strong><span>$DOGG</span></div>
    </header>

    <div className="mines-stats">
      <div><small>{t('games.current')}</small><strong>x{(active ? round!.mult ?? 1 : 1).toFixed(2)}</strong></div>
      <div><small>{t('games.next')}</small><strong className="gold">x{nextMult.toFixed(2)}</strong></div>
      <div><small>{t('games.found')}</small><strong>{picks}/{25 - (round?.mines ?? mines)}</strong></div>
    </div>

    <div className={`mines-grid ${round?.status === 'lost' ? 'lost' : ''}`}>
      {Array.from({ length: 25 }, (_, i) => {
        const isMine = boardMines.has(i);
        const open = revealed.has(i);
        const ended = round && !active;
        const state = open ? (isMine ? 'boom' : 'bud') : ended ? (isMine ? 'mine-dim' : 'bud-dim') : 'closed';
        return <button key={i} type="button" aria-label={t('games.tile', { n: i + 1 })} className={`mine-tile ${state} ${pending === i ? 'pending' : ''}`} disabled={!active || open || busy} onClick={() => void run('reveal', i)}>
          {(state === 'bud' || state === 'bud-dim') && <img src={bud} alt="" width={96} height={96} draggable={false} />}
          {(state === 'boom' || state === 'mine-dim') && <img src={siren} alt="" width={96} height={96} draggable={false} />}
          {state === 'closed' && <i />}
        </button>;
      })}
    </div>

    {active ? <Button className="mines-cash" disabled={busy || picks === 0} onClick={() => void run('cashout')}><Coins /> {picks === 0 ? t('games.pickFirst') : t('games.cashout', { n: fmt(cashValue) })}</Button> : <>
      <div className="mines-pick"><small>{t('games.bet')}</small><div>{MINES_BETS.map(b => <button key={b} type="button" className={bet === b ? 'on' : ''} onClick={() => { haptic(); setBet(b); }}>{b}</button>)}</div></div>
      <div className="mines-pick"><small>{t('games.risk')}</small><div>{MINES_MODES.map(m => <button key={m} type="button" className={mines === m ? 'on' : ''} onClick={() => { haptic(); setMines(m); }}><Bomb /> {m} <em>{t(m === 3 ? 'games.chill' : m === 5 ? 'games.hood' : 'games.dope')}</em></button>)}</div></div>
      <Button className="mines-play" disabled={busy} onClick={() => void run('start')}><Dices /> {t('games.play', { n: bet })}</Button>
    </>}
    <p className="mines-rules">{t('games.rules')}</p>
  </section>;
}

const SOON = [
  { key: 'flip', icon: Coins, img: coin },
  { key: 'battle', icon: Swords, img: null },
  { key: 'spin', icon: Dices, img: null },
] as const;

export function Juegos() {
  const t = useT();
  return <div className="games-screen">
    <ScreenHero title={t('nav.games')} green art="leaf" subtitle={t('games.subtitle')} />
    <DoggMines />
    <h3 className="soon-title"><Lock /> {t('games.soon')}</h3>
    <div className="soon-list">{SOON.map(({ key, icon: Icon, img }) => <div key={key} className="soon-card">
      <span className="soon-icon">{img ? <img src={img} alt="" width={40} height={40} loading="lazy" /> : <Icon />}</span>
      <div><strong>{t(`games.${key}` as 'games.flip')}</strong><small>{t(`games.${key}Desc` as 'games.flipDesc')}</small></div>
      <em>{t('games.soonTag')}</em>
    </div>)}</div>
  </div>;
}
