import { useEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowUpRight, ArrowRight, Zap, Clock3, Leaf, LockKeyhole, Sprout, Gamepad2, Check, Users, Copy, Wallet, ExternalLink, Trophy, ShieldCheck, RefreshCw, ChevronRight, Music2, Tv, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useDogg } from './state';
import type { Player } from '@/lib/dogg';
import { SHIFT_MS, formatDogg, JETTON, SWAP, PRICE, haptic, AD_REWARD, AD_DAILY } from '@/lib/dogg';
import mascot from '@/assets/dogg-mascot.webp';
import coin from '@/assets/dogg-coin.webp';
import { ScreenHero, leafArt, bustArt } from './hero';
import { ClubTasks } from './club-tasks';
import { useT } from './lang';
import { PNL_RANGES, pnlSeries, pnlToday, type PnlRange } from '@/lib/pnl';
import { BuyDedustLink, DedustWebLink } from './buy';
import { MINERS, MINER_TIERS, bestLevel, getMiner, minerAt, shiftTotal } from '@/lib/mining';
// Square (1:1) tier scenes: each clip starts and ends on its matching sq-N.webp still, so the poster never jumps.
const CLIP_ASSETS = import.meta.glob<{ url: string }>('@/assets/tiers/sq-tier-*.mp4.asset.json', { eager: true, import: 'default' });
const TIER_CLIP = Array.from({ length: 10 }, (_, index) => Object.entries(CLIP_ASSETS).find(([path]) => path.endsWith(`/sq-tier-${index + 1}.mp4.asset.json`))?.[1].url);
const SQUARE_ART = import.meta.glob<string>('@/assets/tiers/sq-[0-9]*.webp', { eager: true, import: 'default' });
const TIER_ART = Array.from({ length: 10 }, (_, index) => Object.entries(SQUARE_ART).find(([path]) => path.endsWith(`/sq-${index + 1}.webp`))?.[1] ?? '');
function Title({ label, title, accent, description }: { label: string; title: string; accent: string; description: string }) { return <div className="page-heading"><span className="eyebrow"><span />{label}</span><h1>{title} <em>{accent}</em><span className="heading-period">.</span></h1><p>{description}</p></div>; }
function Countdown({ elapsed }: { elapsed: number }) { const s = Math.max(0, Math.ceil((SHIFT_MS - elapsed) / 1000)); return <>{String(Math.floor(s / 3600)).padStart(2, '0')}<span>:</span>{String(Math.floor(s % 3600 / 60)).padStart(2, '0')}<span>:</span>{String(s % 60).padStart(2, '0')}</>; }
export { Title };
/** Tier names are West Coast slang kept in English; only the Spanish "Legendarios" is translated. */
const tierName = (name: string, t: ReturnType<typeof useT>) => name === 'Legendarios' ? t('tier.legend') : name;
/** The six-decimal counter is the only thing that ticks fast; it re-renders on its own instead of the whole app. */
function LiveEarned({ player, live, fallback }: { player: ReturnType<typeof useDogg>['player']; live: boolean; fallback: number }) {
  const [t, setT] = useState(() => Date.now());
  useEffect(() => { if (!live) return; const id = setInterval(() => setT(Date.now()), 100); return () => clearInterval(id); }, [live]);
  const value = live ? shiftTotal(player, t) : fallback;
  return <div className="mine-live" data-testid="turn-total">+{value.toLocaleString('de-DE', { minimumFractionDigits: 6, maximumFractionDigits: 6 })}</div>;
}
export function Humero() {
  const { player, now, action, busy, demo } = useDogg();
  const t = useT();
  const elapsed = player.shiftStartedAt ? Math.max(0, now - Date.parse(player.shiftStartedAt)) : 0;
  const finished = elapsed >= SHIFT_MS;
  const miner = getMiner(player.minerId);
  const earned = shiftTotal(player, now);
  const remaining = Math.max(0, Math.ceil((SHIFT_MS - elapsed) / 60000));
  const live = Boolean(player.shiftStartedAt && !finished);
  return <div className="mine-screen">
    <div className="mine-hero" aria-hidden="true"><img src={bustArt} alt="" width={640} height={634} fetchPriority="high" /></div>
    <section className="mine-stats"><div><span>{t('mine.rate')}</span><strong>{miner.power} TH/s</strong><em className={live ? 'on' : ''}><i />{live ? t('mine.mining') : finished ? t('mine.ready') : t('mine.paused')}</em></div><div><span>{t('mine.rank')}</span><strong>{t('mine.level', { n: miner.level || 1 })}</strong><em>{miner.name}</em></div></section>
    <div className="mine-claimed"><strong>{formatDogg(player.balance)} $DOGG</strong><span>{t('mine.claimed')}</span></div>
    <div className="mine-coin-wrap"><img className="mine-leaf l" src={leafArt} alt="" width={291} height={320} aria-hidden="true" /><img className="mine-leaf r" src={leafArt} alt="" width={291} height={320} aria-hidden="true" /><div className={`mine-coin ${live ? 'spinning' : ''}`}><img className="dogg-coin" src={coin} alt={t('mine.coinAlt')} width={640} height={631} /></div></div>
    <LiveEarned player={player} live={live} fallback={earned} />
    <div className="turn-badges"><span className="turn-badge"><Zap /> {miner.daily} $DOGG/d</span><span className="turn-badge"><Clock3 /> {player.shiftStartedAt ? <Countdown elapsed={elapsed} /> : `${Math.floor(remaining / 60)}h ${remaining % 60}m`}</span></div>
    <div className="mine-claim"><Button className="start-shift" disabled={busy || live} onClick={() => action(player.shiftStartedAt ? 'claim' : 'start')}><Leaf />{busy ? t('mine.processing') : player.shiftStartedAt ? (finished ? t('mine.claim') : t('mine.burning')) : t('mine.start')}<ArrowRight /></Button></div>
    <Button asChild variant="secondary" className="mine-wide"><Link to="/trabajos"><Tv /> {t('mine.tasksLink')}</Link></Button>
    <div className="mine-buy"><BuyDedustLink className="buy-green">{t('mine.buy')}</BuyDedustLink><a href={PRICE} target="_blank" rel="noopener noreferrer" className="buy-gold">{t('mine.price')}</a></div>
    <DedustWebLink />
    <p className="mine-note">{t('mine.note')}</p>
  </div>;
}

export function Trabajos() {
  const { now, wallet } = useDogg();
  const t = useT();
  return <><ScreenHero title={t('tasks.title')} art="leaf" subtitle={<>{t('tasks.subtitle')} <b>$DOGG</b></>} />
    <AdsCard />
    <ClubTasks />
    <div className="section-heading task-heading"><h2>Hustle board</h2><span>ON-CHAIN & SOCIAL</span></div><div className="task-list"><Task icon={<Wallet />} title={t('tasks.hold')} subtitle={t('tasks.holdSub')} reward="ON-CHAIN"><Button asChild variant="outline"><Link to="/perfil">{wallet ? t('tasks.seeBalance') : t('tasks.connect')}<ArrowUpRight /></Link></Button></Task><Task icon={<Users />} title={t('tasks.invite')} subtitle={t('tasks.inviteSub')} reward={t('tasks.refTag')}><Button asChild variant="outline"><Link to="/amigos">{t('tasks.inviteBtn')} <ArrowRight /></Link></Button></Task></div></>;
}
function AdsCard() {
  const { adsToday, rewardAd, demo } = useDogg();
  const t = useT();
  const [watching, setWatching] = useState(false);
  const remaining = Math.max(0, AD_DAILY - adsToday);
  const watch = async () => { if (watching) return; setWatching(true); try { await rewardAd(); } finally { setWatching(false); } };
  return <section className="ads-card" aria-label={t('ads.title')}>
    <div className="ads-top"><span className="ads-icon"><Tv /></span><div><h2>{t('ads.title')}</h2><p>{t('ads.per', { r: AD_REWARD, n: adsToday, max: AD_DAILY })}</p></div></div>
    <div className="ads-bar" role="progressbar" aria-valuemin={0} aria-valuemax={AD_DAILY} aria-valuenow={adsToday}><i style={{ width: `${adsToday / AD_DAILY * 100}%` }} /></div>
    <small>{remaining ? t('ads.left', { n: remaining }) : t('ads.tomorrow')}</small>
    <Button className="ads-button" disabled={!remaining || watching} onClick={watch}>{watching ? t('ads.watching') : <><Play /> {t('ads.watch', { r: AD_REWARD })}</>}</Button>
  </section>;
}
function Task({ icon, title, subtitle, reward, children }: { icon: React.ReactNode; title: string; subtitle: string; reward: string; children: React.ReactNode }) { return <article className="task-row"><span className="task-icon">{icon}</span><div className="task-body"><div className="task-top"><h3>{title}</h3><small>{reward}</small></div><p>{subtitle}</p></div><div className="task-action">{children}</div></article>; }
function Arcade() {
  const t = useT();
  const [playing, setPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(20);
  const [pos, setPos] = useState(4);
  useEffect(() => { if (!playing) return; const id=setInterval(() => setTime(t => Math.max(0,t-1)),1000); return () => clearInterval(id); },[playing]);
  useEffect(() => { if(time===0) setPlaying(false); },[time]);
  return <div className="arcade-banner"><Gamepad2 /><div><span className="eyebrow text-gold">DOGG ARCADE</span><h2>{t('arcade.title')}</h2><p>{t('arcade.sub')}</p></div><Dialog onOpenChange={open => { if (!open) setPlaying(false); }}><DialogTrigger asChild><Button>{t('arcade.play')} <ArrowUpRight /></Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Catch the leaf 🌱</DialogTitle></DialogHeader><div className="flex justify-between text-primary"><strong>{t('arcade.leaves', { n: score })}</strong><span>{time}s</span></div><div className="arcade-grid">{Array.from({ length:9 },(_,i)=><Button aria-label={pos===i ? t('arcade.catch') : t('arcade.empty')} key={i} variant="outline" disabled={!playing} onClick={() => { if(i===pos){ haptic(); setScore(s=>s+1); setPos((pos+1+Math.floor(Math.random()*7))%9); } }}>{pos===i && <Leaf />}</Button>)}</div><Button onClick={()=>{setTime(20);setScore(0);setPlaying(true);}} disabled={playing}>{time===0 ? t('arcade.again') : t('arcade.start')}</Button><p className="text-xs text-muted-foreground">{t('arcade.note')}</p></DialogContent></Dialog></div>;
}
function HoldSummary({ player, demo, busy, current, onActivate }: { player: Player; demo: boolean; busy: boolean; current: number; onActivate: (id: string) => void }) {
  const t = useT();
  const hold = demo ? 0 : player.hold ?? 0;
  const total = player.balance + hold;
  const top = bestLevel(total);
  const next = top < 500 ? minerAt(top + 1) : null;
  const best = minerAt(top);
  return <>
    <div className="pnl-strip">
      <div><small>{t('boost.wallet')}{player.walletAddress || demo ? '' : ` ${t('boost.unlinked')}`}</small><b>{formatDogg(hold)}</b></div>
      <div><small>{t('boost.inApp')}</small><b>{formatDogg(player.balance)}</b></div>
      <div className="total"><small>{t('boost.total')}</small><b>{formatDogg(total)}</b></div>
    </div>
    <p className="pnl-hint">{(next ? t('boost.missing', { x: formatDogg(Math.max(0, next.hold - total)), n: next.level }) : t('boost.max')).trim()}</p>
    {top > current && <Button className="w-full" size="sm" disabled={busy} onClick={() => onActivate(best.id)}><Zap /> {t('boost.upNow', { n: top })}</Button>}
  </>;
}
function PnlChart() {
  const { history, earnedBefore, now, player, demo, busy, activateMiner } = useDogg();
  const t = useT();
  const [range, setRange] = useState<PnlRange>('7d');
  const today = pnlToday(history, now);
  const { gained, line, hasData } = pnlSeries(history, now, range, earnedBefore);
  const miner = getMiner(player.minerId);
  const fmt = (v: number) => v.toLocaleString('de-DE', { maximumFractionDigits: 2 });
  return <section className="boost-head pnl-card">
    <div className="pnl-top"><strong>{t('mine.level', { n: miner.level || 1 })}</strong><em>{tierName(miner.category, t)}</em><span>{t('boost.pnl', { x: fmt(today) })}</span></div>
    <HoldSummary player={player} demo={demo} busy={busy} current={miner.level || 1} onActivate={id => void activateMiner(id)} />
    <div className="pnl-chart-head">
      <b>+{fmt(gained)} $DOGG</b>
      <div className="pnl-ranges" role="tablist">{(Object.keys(PNL_RANGES) as PnlRange[]).map(r => <button key={r} role="tab" aria-selected={range === r} className={range === r ? 'active' : ''} onClick={() => { haptic(); setRange(r); }}>{r === 'All' ? t('boost.all') : r}</button>)}</div>
    </div>
    {hasData
      ? <svg className="pnl-chart" viewBox="0 0 100 40" preserveAspectRatio="none" aria-label={t('boost.chart')}><polygon points={`0,40 ${line} 100,40`} /><polyline points={line} /></svg>
      : <p className="pnl-empty">{t('boost.noGains')}</p>}
  </section>;
}
const PAGE = 10;
export function GrowOps() {
  const { player, demo, busy, activateMiner } = useDogg();
  const t = useT();
  const currentMiner = getMiner(player.minerId);
  const current = currentMiner.category;
  const [tier, setTier] = useState<string>(MINER_TIERS.includes(current as never) ? current : MINER_TIERS[0]);
  const inTier = MINERS.filter(m => m.category === tier);
  const activeIndex = inTier.findIndex(m => m.id === player.minerId);
  const [page, setPage] = useState(activeIndex >= 0 ? Math.floor(activeIndex / PAGE) : 0);
  const pages = Math.max(1, Math.ceil(inTier.length / PAGE));
  const tierIndex = MINER_TIERS.indexOf(tier as never);
  const shown = inTier.slice(page * PAGE, page * PAGE + PAGE);
  const pickTier = (t: string) => { haptic(); setTier(t); const i = MINERS.filter(m => m.category === t).findIndex(m => m.id === player.minerId); setPage(i >= 0 ? Math.floor(i / PAGE) : 0); };
  const go = (d: number) => { haptic(); setPage(p => Math.min(pages - 1, Math.max(0, p + d))); };
  return <><ScreenHero title={t('nav.boost')} green art="cap" subtitle={t('boost.subtitle')} /><PnlChart /><h2 className="vault-h">{t('boost.packs')}</h2>
    <div className="grow-notice"><ShieldCheck /><span>{player.walletAddress ? t('boost.noticeLinked', { n: (player.hold ?? 0).toLocaleString('de-DE') }) : t('boost.noticeConnect')}</span></div>
    <div className="tier-tabs" role="tablist">{MINER_TIERS.map((tierLabel, i) => <button key={tierLabel} role="tab" aria-selected={tier === tierLabel} className={`rank-${i + 1} ${tier === tierLabel ? 'active' : ''}`} onClick={() => pickTier(tierLabel)}><small>{t('boost.tierRange', { a: i * 50 + 1, b: i * 50 + 50 })}</small>{tierName(tierLabel, t)}</button>)}</div>
    <section className="miner-category">
      <div className="miner-pager"><Button size="sm" onClick={() => go(-1)} disabled={page === 0}>{t('boost.prev')}</Button><span><b>{tierName(tier, t)}</b>{t('boost.range', { a: tierIndex * 50 + page * PAGE + 1, b: tierIndex * 50 + Math.min(inTier.length, page * PAGE + PAGE) })}</span><Button size="sm" onClick={() => go(1)} disabled={page >= pages - 1}>{t('boost.next')}</Button></div>
      <div className="grow-grid">{shown.map(miner => {
        const active = player.minerId === miner.id;
        const eligible = miner.hold === 0 || player.balance + (demo ? 0 : player.hold ?? 0) >= miner.hold;
        const reached = miner.daily < currentMiner.daily;
        return <article key={miner.id} className={`grow-card rank-${tierIndex + 1} ${active ? 'owned' : ''}`} aria-label={miner.name}>
          <div className={`grow-art tier-art ${active ? 'live' : 'idle'}`}>{active ? <video src={TIER_CLIP[tierIndex]} poster={TIER_ART[tierIndex]} autoPlay muted loop playsInline preload="auto" aria-label={t('boost.artAlt', { tier: tierName(tier, t) })} /> : <img src={TIER_ART[tierIndex] ?? TIER_ART[0]} alt={t('boost.artAlt', { tier: tierName(tier, t) })} loading="lazy" />}<span className="grow-badge">{active ? <Check size={13} /> : !eligible ? <LockKeyhole size={13} /> : <Sprout size={13} />}</span></div>
          <h2>{miner.name}</h2>
          <div className="grow-stats"><strong><Zap size={13} /> +{miner.power} <small>TH/s</small></strong><span>{miner.daily} $DOGG/d</span></div>
          {!eligible && <div className="hold-requirement"><Wallet />{t('boost.hold', { n: miner.hold.toLocaleString('de-DE') })}</div>}
          <Button variant={active ? 'default' : eligible && !reached ? 'default' : 'secondary'} className="miner-state-button w-full" disabled={busy || active || !eligible || reached} onClick={() => void activateMiner(miner.id)}>{active ? <><Check /> {t('boost.mining')}</> : eligible ? (reached ? t('boost.reached') : t('boost.mine')) : t('boost.keep', { n: miner.hold.toLocaleString('de-DE') })}</Button>
        </article>;
      })}</div>
      <p className="tier-count">{t('boost.count', { n: MINERS.length, p: page + 1, t: pages })}</p>
    </section>
  </>;
}

