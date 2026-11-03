import { useEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowUpRight, ArrowRight, Zap, Clock3, Leaf, LockKeyhole, Sprout, Gamepad2, Check, Users, Copy, Wallet, ExternalLink, Trophy, ShieldCheck, RefreshCw, ChevronRight, Music2, Tv, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useDogg } from './state';
import type { Player } from '@/lib/dogg';
import { SHIFT_MS, formatDogg, JETTON, SWAP, PRICE, haptic, AD_REWARD, AD_DAILY } from '@/lib/dogg';
import mascot from '@/assets/dogg-mascot.jpg';
import coin from '@/assets/dogg-coin.png';
import { ScreenHero, leafArt, bustCapArt } from './hero';
import { MINERS, MINER_TIERS, bestLevel, getMiner, minerAt, shiftTotal } from '@/lib/mining';
// Square (1:1) tier scenes: each clip starts and ends on its matching sq-N.jpg still, so the poster never jumps.
const CLIP_ASSETS = import.meta.glob<{ url: string }>('@/assets/tiers/sq-tier-*.mp4.asset.json', { eager: true, import: 'default' });
const TIER_CLIP = Array.from({ length: 10 }, (_, index) => Object.entries(CLIP_ASSETS).find(([path]) => path.endsWith(`/sq-tier-${index + 1}.mp4.asset.json`))?.[1].url);
const SQUARE_ART = import.meta.glob<string>('@/assets/tiers/sq-*.jpg', { eager: true, import: 'default' });
const TIER_ART = Array.from({ length: 10 }, (_, index) => Object.entries(SQUARE_ART).find(([path]) => path.endsWith(`/sq-${index + 1}.jpg`))?.[1] ?? '');
function Title({ label, title, accent, description }: { label: string; title: string; accent: string; description: string }) { return <div className="page-heading"><span className="eyebrow"><span />{label}</span><h1>{title} <em>{accent}</em><span className="heading-period">.</span></h1><p>{description}</p></div>; }
function Countdown({ elapsed }: { elapsed: number }) { const s = Math.max(0, Math.ceil((SHIFT_MS - elapsed) / 1000)); return <>{String(Math.floor(s / 3600)).padStart(2, '0')}<span>:</span>{String(Math.floor(s % 3600 / 60)).padStart(2, '0')}<span>:</span>{String(s % 60).padStart(2, '0')}</>; }
export { Title };
export function Humero() {
  const { player, now, action, busy, demo } = useDogg();
  const elapsed = player.shiftStartedAt ? Math.max(0, now - Date.parse(player.shiftStartedAt)) : 0;
  const finished = elapsed >= SHIFT_MS;
  const miner = getMiner(player.minerId);
  const earned = shiftTotal(player, now);
  const remaining = Math.max(0, Math.ceil((SHIFT_MS - elapsed) / 60000));
  const live = Boolean(player.shiftStartedAt && !finished);
  return <div className="mine-screen">
    <div className="mine-hero" aria-hidden="true"><img src={bustCapArt} alt="" width={640} height={634} fetchPriority="high" /></div>
    <section className="mine-stats"><div><span>TASA DE MINERÍA</span><strong>{miner.power} TH/s</strong><em className={live ? 'on' : ''}><i />{live ? 'Minando' : finished ? 'Cosecha lista' : 'En pausa'}</em></div><div><span>RANGO ACTUAL</span><strong>Nivel {miner.level || 1}</strong><em>{miner.name}{demo ? ' · demo' : ''}</em></div></section>
    <div className="mine-claimed"><strong>{formatDogg(player.balance)} $DOGG</strong><span>Reclamado en la app</span></div>
    <div className="mine-coin-wrap"><img className="mine-leaf l" src={leafArt} alt="" width={291} height={320} aria-hidden="true" /><img className="mine-leaf r" src={leafArt} alt="" width={291} height={320} aria-hidden="true" /><div className={`mine-coin ${live ? 'spinning' : ''}`}><img className="dogg-coin" src={coin} alt="Moneda oficial del jetton $DOGG" width={640} height={631} /></div></div>
    <div className="mine-live" data-testid="turn-total">+{earned.toLocaleString('de-DE', { minimumFractionDigits: 6, maximumFractionDigits: 6 })}</div>
    <div className="turn-badges"><span className="turn-badge"><Zap /> {miner.daily} $DOGG/d</span><span className="turn-badge"><Clock3 /> {player.shiftStartedAt ? <Countdown elapsed={elapsed} /> : `${Math.floor(remaining / 60)}h ${remaining % 60}m`}</span></div>
    <div className="mine-claim"><Button className="start-shift" disabled={busy || live} onClick={() => action(player.shiftStartedAt ? 'claim' : 'start')}><Leaf />{busy ? 'Procesando…' : player.shiftStartedAt ? (finished ? 'PUFF PUFF, COBRA' : 'QUEMANDO EL TURNO') : 'PRENDE EL TURNO'}<ArrowRight /></Button></div>
    <Button asChild variant="secondary" className="mine-wide"><Link to="/trabajos"><Tv /> Mira anuncios y tareas del hood</Link></Button>
    <div className="mine-buy"><a href={SWAP} target="_blank" rel="noopener noreferrer" className="buy-green">Comprar en DeDust</a><a href={PRICE} target="_blank" rel="noopener noreferrer" className="buy-gold">Ver precio</a></div>
    <p className="mine-note">También puedes comprar y vender $DOGG desde Tonkeeper. Lo que tengas en tu wallet cuenta para tu rango.</p>
  </div>;
}

export function Trabajos() {
  const { now, wallet } = useDogg();
  const [socialStart, setSocialStart] = useState<number | null>(null);
  return <><ScreenHero title="Tareas" art="leaf" subtitle={<>Completa tareas y gana más <b>$DOGG</b></>} />
    <AdsCard />
    <div className="section-heading task-heading"><h2>Hustle board</h2><span>ON-CHAIN & SOCIAL</span></div><div className="task-list"><Task icon={<Wallet />} title="Hold $DOGG. Representa al hood." subtitle="Conecta tu wallet para consultar tu stash on-chain." reward="ON-CHAIN"><Button asChild variant="outline"><Link to="/perfil">{wallet ? 'Ver mi saldo' : 'Conectar wallet'}<ArrowUpRight /></Link></Button></Task><Task icon={<Users />} title="Invita a tus homies" subtitle="El grow es mejor cuando crecemos juntos." reward="REFERIDOS"><Button asChild variant="outline"><Link to="/amigos">Invitar <ArrowRight /></Link></Button></Task><Task icon={<Music2 />} title="Representa a DOGG en redes" subtitle={socialStart ? 'Tiempo de espera · la verificación social aún no está activada.' : 'Temporizador de ejemplo. Recompensa pendiente de verificación.'} reward="24H"><Button variant="outline" onClick={() => { haptic(); setSocialStart(Date.now()); }} disabled={Boolean(socialStart)}>{socialStart ? <Countdown elapsed={now-socialStart} /> : 'Iniciar tarea'}<Clock3 /></Button></Task></div><Arcade /></>;
}
function AdsCard() {
  const { adsToday, rewardAd, demo } = useDogg();
  const [watching, setWatching] = useState(false);
  const remaining = Math.max(0, AD_DAILY - adsToday);
  const watch = async () => { if (watching) return; setWatching(true); try { await rewardAd(); } finally { setWatching(false); } };
  return <section className="ads-card" aria-label="Ver anuncios">
    <div className="ads-top"><span className="ads-icon"><Tv /></span><div><h2>Ver anuncios</h2><p>+{AD_REWARD} $DOGG por anuncio · {adsToday}/{AD_DAILY} hoy</p></div></div>
    <div className="ads-bar" role="progressbar" aria-valuemin={0} aria-valuemax={AD_DAILY} aria-valuenow={adsToday}><i style={{ width: `${adsToday / AD_DAILY * 100}%` }} /></div>
    <small>{remaining ? `Te quedan ${remaining} hoy · mira el anuncio completo para cobrar` : 'Vuelve mañana para ver más anuncios'}</small>
    <Button className="ads-button" disabled={!remaining || watching} onClick={watch}>{watching ? 'Anuncio en curso…' : <><Play /> Ver anuncio (+{AD_REWARD} $DOGG)</>}</Button>
    {demo && <p className="ads-note">Modo demo: el anuncio es real, pero los $DOGG son créditos de prueba.</p>}
  </section>;
}
function Task({ icon, title, subtitle, reward, children }: { icon: React.ReactNode; title: string; subtitle: string; reward: string; children: React.ReactNode }) { return <article className="task-row"><span className="task-icon">{icon}</span><div className="task-body"><div className="task-top"><h3>{title}</h3><small>{reward}</small></div><p>{subtitle}</p></div><div className="task-action">{children}</div></article>; }
function Arcade() {
  const [playing, setPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(20);
  const [pos, setPos] = useState(4);
  useEffect(() => { if (!playing) return; const id=setInterval(() => setTime(t => Math.max(0,t-1)),1000); return () => clearInterval(id); },[playing]);
  useEffect(() => { if(time===0) setPlaying(false); },[time]);
  return <div className="arcade-banner"><Gamepad2 /><div><span className="eyebrow text-gold">DOGG ARCADE</span><h2>Un break para el hustle.</h2><p>Catch the leaf · 20 segundos · sin apuestas</p></div><Dialog onOpenChange={open => { if (!open) setPlaying(false); }}><DialogTrigger asChild><Button>JUGAR <ArrowUpRight /></Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Catch the leaf 🌱</DialogTitle></DialogHeader><div className="flex justify-between text-primary"><strong>{score} hojas</strong><span>{time}s</span></div><div className="arcade-grid">{Array.from({ length:9 },(_,i)=><Button aria-label={pos===i ? 'Atrapar hoja' : 'Casilla vacía'} key={i} variant="outline" disabled={!playing} onClick={() => { if(i===pos){ haptic(); setScore(s=>s+1); setPos((pos+1+Math.floor(Math.random()*7))%9); } }}>{pos===i && <Leaf />}</Button>)}</div><Button onClick={()=>{setTime(20);setScore(0);setPlaying(true);}} disabled={playing}>{time===0 ? 'VOLVER A JUGAR' : 'INICIAR PARTIDA'}</Button><p className="text-xs text-muted-foreground">Partida de práctica. No genera tokens ni créditos.</p></DialogContent></Dialog></div>;
}
function HoldSummary({ player, demo, busy, current, onActivate }: { player: Player; demo: boolean; busy: boolean; current: number; onActivate: (id: string) => void }) {
  const hold = demo ? 0 : player.hold ?? 0;
  const total = player.balance + hold;
  const top = bestLevel(total);
  const next = top < 500 ? minerAt(top + 1) : null;
  const best = minerAt(top);
  return <div className="hold-summary">
    <div className="hold-sum-row"><span>Wallet {player.walletAddress || demo ? '' : '(sin vincular)'}</span><b>{formatDogg(hold)}</b></div>
    <div className="hold-sum-row"><span>Minado en la app</span><b>{formatDogg(player.balance)}</b></div>
    <div className="hold-sum-row total"><span>Tu hold total</span><b>{formatDogg(total)} $DOGG</b></div>
    <p>Desbloquea hasta el <strong>nivel {top}</strong> · {best.name}.{next ? ` Te faltan ${formatDogg(Math.max(0, next.hold - total))} $DOGG para el nivel ${next.level}.` : ' Tienes el nivel máximo.'} Tu minero sube solo al comprar y baja solo si vendes.</p>
    {top > current && <Button className="w-full" disabled={busy} onClick={() => onActivate(best.id)}><Zap /> Subir ya al nivel {top}</Button>}
  </div>;
}
const RANGES = { '24h': 864e5, '7d': 7 * 864e5, '30d': 30 * 864e5, All: Infinity } as const;
function PnlChart() {
  const { history, now, player, demo, busy, activateMiner } = useDogg();
  const [range, setRange] = useState<keyof typeof RANGES>('7d');
  const from = now - RANGES[range];
  const gains = history.filter(e => e.amount > 0).sort((a, b) => a.at - b.at);
  const today = gains.filter(e => e.at >= now - 864e5).reduce((a, e) => a + e.amount, 0);
  let acc = gains.filter(e => e.at < from).reduce((a, e) => a + e.amount, 0);
  const pts: [number, number][] = [[Number.isFinite(from) ? from : (gains[0]?.at ?? now - 864e5), acc]];
  for (const e of gains.filter(e => e.at >= from)) { pts.push([e.at, acc]); acc += e.amount; pts.push([e.at, acc]); }
  pts.push([now, acc]);
  const x0 = pts[0]![0], span = Math.max(1, now - x0), top = Math.max(1, acc);
  const line = pts.map(([t, v]) => `${((t - x0) / span * 100).toFixed(2)},${(38 - v / top * 34).toFixed(2)}`).join(' ');
  const miner = getMiner(player.minerId);
  return <section className="boost-head">
    <div className="boost-level"><div><strong>Nivel {miner.level || 1}</strong><span>PNL de hoy +{today.toLocaleString('de-DE', { maximumFractionDigits: 2 })} $DOGG</span></div><em>{miner.category}</em></div>
    <HoldSummary player={player} demo={demo} busy={busy} current={miner.level || 1} onActivate={id => void activateMiner(id)} />
    <div className="boost-ranges" role="tablist">{(Object.keys(RANGES) as (keyof typeof RANGES)[]).map(r => <button key={r} role="tab" aria-selected={range === r} className={range === r ? 'active' : ''} onClick={() => { haptic(); setRange(r); }}>{r === 'All' ? 'Todo' : r}</button>)}</div>
    <svg className="boost-chart" viewBox="0 0 100 40" preserveAspectRatio="none" aria-label="Progreso de $DOGG ganado"><polygon points={`0,40 ${line} 100,40`} /><polyline points={line} /></svg>
  </section>;
}
const PAGE = 10;
export function GrowOps() {
  const { player, demo, busy, activateMiner } = useDogg();
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
  return <><ScreenHero title="Boost" green art="cap" subtitle="Aumenta tu velocidad de minería" /><PnlChart /><h2 className="vault-h">Paquetes de velocidad</h2>
    <div className="grow-notice"><ShieldCheck /><span>{demo ? 'Demo · requisitos basados en créditos de prueba. Los saldos de wallet son independientes.' : player.walletAddress ? `Wallet vinculada · ${(player.hold ?? 0).toLocaleString('de-DE')} $DOGG en hold desbloquean tus mineros.` : 'Conecta tu wallet en Perfil para que tu $DOGG desbloquee mineros.'}</span></div>
    <div className="tier-tabs" role="tablist">{MINER_TIERS.map((t, i) => <button key={t} role="tab" aria-selected={tier === t} className={`rank-${i + 1} ${tier === t ? 'active' : ''}`} onClick={() => pickTier(t)}><small>NIVEL {i * 50 + 1}–{i * 50 + 50}</small>{t}</button>)}</div>
    <section className="miner-category">
      <div className="miner-pager"><Button size="sm" onClick={() => go(-1)} disabled={page === 0}>Anterior</Button><span><b>{tier}</b>Nivel {tierIndex * 50 + page * PAGE + 1}–{tierIndex * 50 + Math.min(inTier.length, page * PAGE + PAGE)}</span><Button size="sm" onClick={() => go(1)} disabled={page >= pages - 1}>Siguiente</Button></div>
      <div className="grow-grid">{shown.map(miner => {
        const active = player.minerId === miner.id;
        const eligible = miner.hold === 0 || player.balance + (demo ? 0 : player.hold ?? 0) >= miner.hold;
        const reached = miner.daily < currentMiner.daily;
        return <article key={miner.id} className={`grow-card rank-${tierIndex + 1} ${active ? 'owned' : ''}`} aria-label={miner.name}>
          <div className={`grow-art tier-art ${active ? 'live' : 'idle'}`}>{active ? <video src={TIER_CLIP[tierIndex]} poster={TIER_ART[tierIndex]} autoPlay muted loop playsInline preload="auto" aria-label={`${tier}: DOGG regando su planta`} /> : <img src={TIER_ART[tierIndex] ?? TIER_ART[0]} alt={`${tier}: DOGG regando su planta`} loading="lazy" />}<span className="grow-badge">{active ? <Check size={13} /> : !eligible ? <LockKeyhole size={13} /> : <Sprout size={13} />}</span></div>
          <h2>{miner.name}</h2>
          <div className="grow-stats"><strong><Zap size={13} /> +{miner.power} <small>TH/s</small></strong><span>{miner.daily} $DOGG/d</span></div>
          {!eligible && <div className="hold-requirement"><Wallet />Hold {miner.hold.toLocaleString('de-DE')}</div>}
          <Button variant={active ? 'default' : eligible && !reached ? 'default' : 'secondary'} className="miner-state-button w-full" disabled={busy || active || !eligible || reached} onClick={() => void activateMiner(miner.id)}>{active ? <><Check /> MINANDO</> : eligible ? (reached ? 'ALCANZADO' : 'MINAR') : `MANTÉN ${miner.hold.toLocaleString('de-DE')}`}</Button>
        </article>;
      })}</div>
      <p className="tier-count">{MINERS.length} mineros · 10 rangos · página {page + 1} de {pages}</p>
    </section>
  </>;
}

