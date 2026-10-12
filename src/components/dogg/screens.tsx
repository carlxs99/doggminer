import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowUpRight, ArrowRight, Zap, Clock3, Leaf, LockKeyhole, Sprout, Flame, Gift, Gamepad2, Check, Users, Copy, Wallet, ExternalLink, Trophy, ShieldCheck, RefreshCw, ChevronRight, Music2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useDogg } from './state';
import { SHIFT_MS, formatDogg, JETTON, SWAP, PRICE, haptic } from '@/lib/dogg';
import mascot from '@/assets/dogg-mascot.jpg';
import coin from '@/assets/dogg-coin.png';
import { MINERS, MINER_TIERS, getMiner, shiftTotal } from '@/lib/mining';
const CLIP_ASSETS = import.meta.glob<{ url: string }>('@/assets/tiers/*.mp4.asset.json', { eager: true, import: 'default' });
const TIER_CLIP = Array.from({ length: 10 }, (_, index) => {
  const level = index + 1;
  const preferred = Object.entries(CLIP_ASSETS).find(([path]) => path.endsWith(`/v2-tier-${level}.mp4.asset.json`));
  const fallback = Object.entries(CLIP_ASSETS).find(([path]) => path.endsWith(`/tier-${level}.mp4.asset.json`));
  return preferred?.[1].url ?? fallback?.[1].url;
});
const POSTERS = import.meta.glob<string>('@/assets/tiers/poster-*.jpg', { eager: true, import: 'default' });
const TIER_ART = Array.from({ length: 10 }, (_, index) => Object.entries(POSTERS).find(([path]) => path.endsWith(`/poster-${index + 1}.jpg`))?.[1] ?? '');
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
  return <><Title label="EL HUMERO" title="Stay high." accent="Stack DOGG" description="Tu turno. Tu cosecha. El hood nunca duerme." />
    <div className="humero-grid"><section className="mining-area"><div className="mining-status"><span className={player.shiftStartedAt ? 'live-label' : 'idle-label'}><i />{player.shiftStartedAt ? (finished ? 'COSECHA LISTA' : 'TURNO EN MARCHA') : 'LISTO PARA EL TURNO'}</span><span className="season">SEASON 01 <span>·</span> THE GENESIS</span></div>
      <div className="mining-balance turn-summary"><h2 className="eyebrow muted">MINADO ESTE TURNO</h2><div className="token-counter" data-testid="turn-total">{earned.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} <span>$DOGG</span></div><div className="turn-badges"><span className="turn-badge"><Zap /> {miner.power} TH/s</span><span className="turn-badge"><Clock3 /> {Math.floor(remaining / 60)}h {remaining % 60}m</span></div><p className="active-miner-caption">{miner.name} · {miner.daily} $DOGG/d {demo && '· DEMO'}</p></div>
      <div className={`mascot-scene coin-scene ${player.shiftStartedAt && !finished ? 'spinning' : ''}`}><img className="dogg-coin" src={coin} alt="Moneda oficial del jetton $DOGG" width={640} height={631} fetchPriority="high" /><span className="scene-chip"><Flame /> ORIGINAL GANGSTA</span><span className="scene-coordinates">33.7701° N<br />118.1937° W</span><div className="scene-caption">LONG BEACH, CA <span>EST. 420</span></div></div>
      <div className="shift-controls"><Button className="start-shift" disabled={busy || Boolean(player.shiftStartedAt && !finished)} onClick={() => action(player.shiftStartedAt ? 'claim' : 'start')}><Leaf />{busy ? 'Procesando…' : player.shiftStartedAt ? (finished ? 'RECLAMAR' : 'TURNO EN MARCHA') : 'INICIAR TURNO'}<ArrowRight /></Button><div className="shift-hint"><Clock3 /><span>{player.shiftStartedAt ? 'Tiempo restante' : 'Un turno de 24h. Una cosecha a tu ritmo.'}</span>{player.shiftStartedAt && <strong><Countdown elapsed={elapsed} /></strong>}</div></div>
    </section>
    <aside className="mining-details"><section className="stash-panel"><div className="panel-heading"><span className="eyebrow">TU STASH</span><span className="gold-icon"><Wallet /></span></div><div className="stash-number">{formatDogg(player.balance)}<span>$DOGG</span></div><p>Créditos de juego acumulados</p><div className="stash-bottom"><span>Turnos completados</span><strong>{String(player.claimedShifts).padStart(2, '0')}</strong></div></section>
      <section className="power-panel"><div className="panel-heading"><span className="eyebrow">GROW POWER</span><Zap className="text-primary" size={18} /></div><div className="power-number">{miner.power} <span>TH/s</span><small>{miner.daily} $DOGG/d</small></div><div className="power-track"><span /></div><div className="power-meta"><span>{miner.name}</span><span>OG Kingpin <LockKeyhole size={12} /></span></div><Button asChild variant="outline" className="w-full"><Link to="/grow-ops">MEJORAR MI GROW <ArrowUpRight /></Link></Button></section>
      <Link to="/trabajos" className="daily-promo"><span className="gift-square"><Gift /></span><div><span className="eyebrow text-gold">DAILY DROP</span><h3>El hood tiene regalos.</h3><p>Recoge tu bonus de hoy.</p></div><ArrowUpRight /></Link>
      <div className="quote-block"><span>“</span><p>It's not about the destination.<br />It's about the <em>grow</em>.</p><small>THE DOGG WAY</small></div>
    </aside></div>
    <section className="hood-strip"><span className="hood-strip-icon"><ShieldCheck /></span><div><h3>Tu hustle, tus reglas.</h3><p>Sin gas para minar. Sin prisas para crecer.</p></div><span className="hood-strip-end"><Leaf /> KEEP IT GROWING</span></section></>;
}

export function Trabajos() {
  const { player, action, busy, now, wallet } = useDogg();
  const [socialStart, setSocialStart] = useState<number | null>(null);
  const checked = player.lastCheckin === new Date(now || 0).toISOString().slice(0, 10);
  return <><Title label="EL TABLÓN" title="Make moves." accent="Get paid" description="Pequeños trabajos. Grandes cosechas. Representa al hood." />
    <section className="daily-section"><div className="section-heading"><h2><Flame /> Daily check-in</h2><span className="text-gold">RACHA: {player.streak} / 7 DÍAS</span></div><div className="day-grid">{[1,2,3,4,5,6,7].map(day => <div key={day} className={`day-item ${day <= player.streak ? 'complete' : ''} ${day === 7 ? 'jackpot' : ''}`}><span>DÍA {day}</span>{day <= player.streak ? <Check /> : day === 7 ? <Gift /> : <Leaf />}<strong>+10</strong><small>créditos</small></div>)}</div><Button onClick={() => action('checkin')} disabled={busy || checked}>{checked ? <><Check /> BONUS RECLAMADO</> : <><Gift /> RECLAMAR BONUS DE HOY</>}</Button></section>
    <div className="section-heading task-heading"><h2>Hustle board</h2><span>ON-CHAIN & SOCIAL</span></div><div className="task-list"><Task icon={<Wallet />} title="Hold $DOGG. Representa al hood." subtitle="Conecta tu wallet para consultar tu stash on-chain." reward="ON-CHAIN"><Button asChild variant="outline"><Link to="/billetera">{wallet ? 'Ver mi saldo' : 'Conectar wallet'}<ArrowUpRight /></Link></Button></Task><Task icon={<Users />} title="Invita a tus homies" subtitle="El grow es mejor cuando crecemos juntos." reward="REFERIDOS"><Button asChild variant="outline"><Link to="/perfil">Invitar <ArrowRight /></Link></Button></Task><Task icon={<Music2 />} title="Representa a DOGG en redes" subtitle={socialStart ? 'Tiempo de espera · la verificación social aún no está activada.' : 'Temporizador de ejemplo. Recompensa pendiente de verificación.'} reward="24H"><Button variant="outline" onClick={() => { haptic(); setSocialStart(Date.now()); }} disabled={Boolean(socialStart)}>{socialStart ? <Countdown elapsed={now-socialStart} /> : 'Iniciar tarea'}<Clock3 /></Button></Task></div><Arcade /></>;
}
function Task({ icon, title, subtitle, reward, children }: { icon: React.ReactNode; title: string; subtitle: string; reward: string; children: React.ReactNode }) { return <article className="task-row"><span className="task-icon">{icon}</span><div><small>{reward}</small><h3>{title}</h3><p>{subtitle}</p></div>{children}</article>; }
function Arcade() {
  const [playing, setPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(20);
  const [pos, setPos] = useState(4);
  useEffect(() => { if (!playing) return; const id=setInterval(() => setTime(t => Math.max(0,t-1)),1000); return () => clearInterval(id); },[playing]);
  useEffect(() => { if(time===0) setPlaying(false); },[time]);
  return <div className="arcade-banner"><Gamepad2 /><div><span className="eyebrow text-gold">DOGG ARCADE</span><h2>Un break para el hustle.</h2><p>Catch the leaf · 20 segundos · sin apuestas</p></div><Dialog onOpenChange={open => { if (!open) setPlaying(false); }}><DialogTrigger asChild><Button>JUGAR <ArrowUpRight /></Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Catch the leaf 🌱</DialogTitle></DialogHeader><div className="flex justify-between text-primary"><strong>{score} hojas</strong><span>{time}s</span></div><div className="arcade-grid">{Array.from({ length:9 },(_,i)=><Button aria-label={pos===i ? 'Atrapar hoja' : 'Casilla vacía'} key={i} variant="outline" disabled={!playing} onClick={() => { if(i===pos){ haptic(); setScore(s=>s+1); setPos((pos+1+Math.floor(Math.random()*7))%9); } }}>{pos===i && <Leaf />}</Button>)}</div><Button onClick={()=>{setTime(20);setScore(0);setPlaying(true);}} disabled={playing}>{time===0 ? 'VOLVER A JUGAR' : 'INICIAR PARTIDA'}</Button><p className="text-xs text-muted-foreground">Partida de práctica. No genera tokens ni créditos.</p></DialogContent></Dialog></div>;
}
export function GrowOps() {
  const { player, demo, busy, activateMiner } = useDogg();
  const current = getMiner(player.minerId).category;
  const [tier, setTier] = useState<string>(MINER_TIERS.includes(current as never) ? current : MINER_TIERS[0]);
  return <><Title label="MINEROS / EQUIPOS" title="Elige tu equipo." accent="Sube el grow" description="La potencia de tu minero marca el ritmo de cada turno." />
    <div className="grow-notice"><ShieldCheck /><span>{demo ? 'Demo · requisitos basados en créditos de prueba. Los saldos de wallet son independientes.' : 'Los mineros con hold están pendientes de verificación de propiedad de la wallet.'}</span></div>
    <div className="tier-tabs" role="tablist">{MINER_TIERS.map((t, i) => <button key={t} role="tab" aria-selected={tier === t} className={tier === t ? 'active' : ''} onClick={() => { haptic(); setTier(t); }}><small>NIVEL {i * 50 + 1}–{i * 50 + 50}</small>{t}</button>)}</div><p className="tier-count">{MINERS.length} mineros · 10 rangos</p>
    {[tier].map(category => <section key={category} className="miner-category"><div className="section-heading"><h2>{category}</h2><span className="text-gold">WEST COAST 420</span></div><div className="grow-grid">{MINERS.filter(m => m.category === category).map(miner => {
      const active = player.minerId === miner.id;
      const eligible = miner.hold === 0 || (demo && player.balance >= miner.hold);
      return <article key={miner.id} className={`grow-card ${active ? 'owned' : ''}`} aria-label={miner.name}>
        <div className="flex justify-between"><span className="eyebrow">{category.toUpperCase()}</span>{active ? <Check className="text-primary" size={16} /> : !eligible ? <LockKeyhole className="text-muted-foreground" size={16} /> : <Sprout className="text-primary" size={16} />}</div>
        <div className={`grow-art tier-art ${active ? 'live' : 'idle'}`}>{active ? <video src={TIER_CLIP[MINER_TIERS.indexOf(category as never)]} poster={TIER_ART[MINER_TIERS.indexOf(category as never)]} autoPlay muted loop playsInline preload="auto" aria-label={`${category}: DOGG regando su planta`} /> : <img src={TIER_ART[MINER_TIERS.indexOf(category as never)] ?? TIER_ART[0]} alt={`${category}: DOGG regando su planta`} loading="lazy" />}</div>
        <h2>{miner.name}</h2><div className="grow-stats"><div><span>Potencia</span><strong><Zap size={15} /> {miner.power} <small>TH/s</small></strong></div><div><span>Producción diaria</span><strong>{miner.daily} <small>$DOGG/d</small></strong></div></div>
        <div className="hold-requirement"><Wallet />{miner.hold === 0 ? 'Disponible para todos' : `Hold: ${miner.hold.toLocaleString('en-US')} $DOGG`}</div>
        <Button variant={active ? 'default' : 'outline'} className="miner-state-button w-full" disabled={busy || active || !eligible} onClick={() => void activateMiner(miner.id)}>{active ? <><Check /> MINANDO AHORA</> : eligible ? 'MINAR' : `MANTÉN ${miner.hold.toLocaleString('en-US')} $DOGG`}</Button>
      </article>;
    })}</div></section>)}
  </>;
}

