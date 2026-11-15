import { useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Bomb, ChevronLeft, ChevronRight, Coins, Dices, Flame, Lock, Swords } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ScreenHero } from './hero';
import { useDogg } from './state';
import { useT } from './lang';
import { haptic } from '@/lib/dogg';
import { minesAction, spinAction, type MinesRound } from '@/lib/games.functions';
import { SPIN_SLOTS, SPIN_BETS } from '@/lib/spin';
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

const SEG = 360 / SPIN_SLOTS.length;
const segColor = (m: number) => m === 25 ? 'jack' : m < 0 ? 'free' : m === 0 ? 'ash' : m >= 5 ? 'gold' : m >= 2 ? 'purple' : m > 1 ? 'green' : 'dark';
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function SpinBlunt() {
  const { demo, player, applyBalance } = useDogg();
  const t = useT();
  const call = useServerFn(spinAction);
  const [bet, setBet] = useState<number>(10);
  const [busy, setBusy] = useState(false);
  const [rot, setRot] = useState(0);
  const [hit, setHit] = useState<number | null>(null);

  async function spin() {
    const initData = window.Telegram?.WebApp?.initData;
    if (demo || !initData) { toast.info(t('games.openTg')); return; }
    if (busy) return;
    setBusy(true); setHit(null); haptic();
    try {
      const r = await call({ data: { initData, bet } });
      let cur = rot;
      for (const [k, slot] of r.slots.entries()) {
        const target = 360 - (slot * SEG + SEG / 2);
        cur = cur - (((cur % 360) + 360) % 360) + 360 * 6 + target;
        setRot(cur);
        const ticks = setInterval(() => window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.('light'), 160);
        await sleep(3600); clearInterval(ticks);
        setHit(slot);
        if (k < r.slots.length - 1) { toast.info(t('games.spinFree')); await sleep(900); }
      }
      applyBalance(r.balance);
      const m = SPIN_SLOTS[r.slots[r.slots.length - 1] ?? 0] ?? 1;
      if (r.payout <= 0) { buzz('error'); toast.error(t('games.spinLost', { n: fmt(r.bet) })); }
      else { buzz('success'); toast.success(t('games.spinWon', { m: m < 0 ? 1 : m, n: fmt(r.payout) })); }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      toast.error(translateServer(msg) ?? t('games.error'));
    } finally { setBusy(false); }
  }

  return <section className="mines-card spin-card">
    <header className="mines-head">
      <div><span className="mines-tag"><Flame /> {t('games.live')}</span><h2>{t('games.spinTitle')}</h2><p>{t('games.spinDesc')}</p></div>
      <div className="mines-bal"><small>{t('games.balance')}</small><strong>{fmt(player.balance)}</strong><span>$DOGG</span></div>
    </header>
    <div className="spin-wrap">
      <span className="spin-pointer" aria-hidden />
      <svg viewBox="-100 -100 200 200" className="spin-wheel" style={{ transform: `rotate(${rot}deg)` }} aria-label={t('games.spinTitle')}>
        {SPIN_SLOTS.map((m, i) => {
          const a0 = (i * SEG - 90) * Math.PI / 180, a1 = ((i + 1) * SEG - 90) * Math.PI / 180;
          const mid = i * SEG + SEG / 2;
          return <g key={i} className={`seg ${segColor(m)} ${hit === i && !busy ? 'hit' : ''}`}>
            <path d={`M0 0 L${96 * Math.cos(a0)} ${96 * Math.sin(a0)} A96 96 0 0 1 ${96 * Math.cos(a1)} ${96 * Math.sin(a1)} Z`} />
            <text transform={`rotate(${mid}) translate(0 -72) rotate(90)`} textAnchor="middle" dominantBaseline="middle">{m < 0 ? 'FREE' : m === 0 ? '💀' : `x${m}`}</text>
          </g>;
        })}
        <circle r="96" className="rim" />
        <circle r="22" className="hub" />
        <image href={coin} x="-19" y="-19" width="38" height="38" />
      </svg>
    </div>
    <div className="mines-pick"><small>{t('games.bet')}</small><div>{SPIN_BETS.map(b => <button key={b} type="button" disabled={busy} className={bet === b ? 'on' : ''} onClick={() => { haptic(); setBet(b); }}>{b}</button>)}</div></div>
    <Button className="mines-play" disabled={busy} onClick={() => void spin()}><Dices /> {busy ? t('games.spinning') : t('games.spinPlay', { n: bet })}</Button>
    <p className="mines-rules">{t('games.spinRules')}</p>
  </section>;
}

const SOON = [
  { key: 'flip', icon: Coins, img: coin },
  { key: 'battle', icon: Swords, img: null },
] as const;

export function Juegos() {
  const t = useT();
  const [open, setOpen] = useState<'mines' | 'spin' | null>(null);
  const go = (g: 'mines' | 'spin' | null) => { haptic(); setOpen(g); window.scrollTo({ top: 0 }); };
  return <div className="games-screen">
    <ScreenHero title={t('nav.games')} green art="leaf" subtitle={t('games.subtitle')} />
    {open ? <>
      <button type="button" className="games-back" onClick={() => go(null)}><ChevronLeft /> {t('games.back')}</button>
      {open === 'mines' ? <DoggMines /> : <SpinBlunt />}
    </> : <>
      <h3 className="soon-title"><Flame /> {t('games.available')}</h3>
      <div className="soon-list">
        {([['mines', bud, 'DOGG MINES', 'games.minesDesc'], ['spin', coin, t('games.spinTitle'), 'games.spinDesc']] as const).map(([key, img, title, desc]) =>
          <button key={key} type="button" className="soon-card game-card" onClick={() => go(key)}>
            <span className="soon-icon"><img src={img} alt="" width={40} height={40} /></span>
            <div><strong>{title}</strong><small>{t(desc)}</small></div>
            <ChevronRight className="game-go" />
          </button>)}
      </div>
      <h3 className="soon-title"><Lock /> {t('games.soon')}</h3>
      <div className="soon-list">{SOON.map(({ key, icon: Icon, img }) => <div key={key} className="soon-card">
        <span className="soon-icon">{img ? <img src={img} alt="" width={40} height={40} loading="lazy" /> : <Icon />}</span>
        <div><strong>{t(`games.${key}` as 'games.flip')}</strong><small>{t(`games.${key}Desc` as 'games.flipDesc')}</small></div>
        <em>{t('games.soonTag')}</em>
      </div>)}</div>
    </>}
  </div>;
}
