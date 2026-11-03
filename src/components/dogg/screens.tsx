import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowUpRight, ArrowRight, Zap, Clock3, Leaf, LockKeyhole, Sprout, Flame, Gift, Gamepad2, Check, Users, Copy, Wallet, ExternalLink, Trophy, ShieldCheck, RefreshCw, ChevronRight, Music2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useDogg } from './state';
import type { Player } from '@/lib/dogg';
import { SHIFT_MS, formatDogg, JETTON, SWAP, PRICE, haptic } from '@/lib/dogg';
import mascot from '@/assets/dogg-mascot.jpg';
import coin from '@/assets/dogg-coin.png';
import { MINERS, MINER_TIERS, bestLevel, getMiner, minerAt, shiftTotal } from '@/lib/mining';
const CLIP_ASSETS = import.meta.glob<{ url: string }>('@/assets/tiers/*.mp4.asset.json', { eager: true, import: 'default' });
const TIER_CLIP = Array.from({ length: 10 }, (_, index) => {
  const level = index + 1;
  const finalClip = Object.entries(CLIP_ASSETS).find(([path]) => path.endsWith(`/final-tier-${level}.mp4.asset.json`));
  const previousClip = Object.entries(CLIP_ASSETS).find(([path]) => path.endsWith(`/v2-tier-${level}.mp4.asset.json`));
  const fallback = Object.entries(CLIP_ASSETS).find(([path]) => path.endsWith(`/tier-${level}.mp4.asset.json`));
  return finalClip?.[1].url ?? previousClip?.[1].url ?? fallback?.[1].url;
});
const WIDE_ART = import.meta.glob<string>('@/assets/tiers/wide-*.jpg', { eager: true, import: 'default' });
const TIER_ART = Array.from({ length: 10 }, (_, index) => Object.entries(WIDE_ART).find(([path]) => path.endsWith(`/wide-${index + 1}.jpg`))?.[1] ?? '');
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
    <section className="mine-stats"><div><span>TASA DE MINERÍA</span><strong>{miner.power} TH/s</strong><em className={live ? 'on' : ''}><i />{live ? 'Minando' : finished ? 'Cosecha lista' : 'En pausa'}</em></div><div><span>RANGO ACTUAL</span><strong>Nivel {miner.level || 1}</strong><em>{miner.name}{demo ? ' · demo' : ''}</em></div></section>
    <div className="mine-claimed"><strong>{formatDogg(player.balance)} $DOGG</strong><span>Reclamado en la app</span></div>
    <div className={`mine-coin ${live ? 'spinning' : ''}`}><img className="dogg-coin" src={coin} alt="Moneda oficial del jetton $DOGG" width={640} height={631} fetchPriority="high" /></div>
    <div className="mine-live" data-testid="turn-total">+{earned.toLocaleString('de-DE', { minimumFractionDigits: 6, maximumFractionDigits: 6 })}</div>
    <div className="turn-badges"><span className="turn-badge"><Zap /> {miner.daily} $DOGG/d</span><span className="turn-badge"><Clock3 /> {player.shiftStartedAt ? <Countdown elapsed={elapsed} /> : `${Math.floor(remaining / 60)}h ${remaining % 60}m`}</span></div>
    <div className="mine-claim"><Button className="start-shift" disabled={busy || live} onClick={() => action(player.shiftStartedAt ? 'claim' : 'start')}><Leaf />{busy ? 'Procesando…' : player.shiftStartedAt ? (finished ? 'PUFF PUFF, COBRA' : 'QUEMANDO EL TURNO') : 'PRENDE EL TURNO'}<ArrowRight /></Button></div>
    <Button asChild variant="secondary" className="mine-wide"><Link to="/trabajos"><Gift /> Bonus diario y tareas del hood</Link></Button>
    <div className="mine-buy"><a href={SWAP} target="_blank" rel="noopener noreferrer" className="buy-green">Comprar en DeDust</a><a href={PRICE} target="_blank" rel="noopener noreferrer" className="buy-gold">Ver precio</a></div>
    <p className="mine-note">También puedes comprar y vender $DOGG desde Tonkeeper. Lo que tengas en tu wallet cuenta para tu rango.</p>
  </div>;
}

export function Trabajos() {
  const { player, action, busy, now, wallet } = useDogg();
  const [socialStart, setSocialStart] = useState<number | null>(null);
  const checked = player.lastCheckin === new Date(now || 0).toISOString().slice(0, 10);
  return <><div className="screen-head"><small>$DOGG MINER</small><h1>Tareas $DOGG</h1><p>Completa tareas del hood y bonus diarios para ganar $DOGG.</p></div>
    <section className="daily-section"><div className="section-heading"><h2><Flame /> Daily check-in</h2><span className="text-gold">RACHA: {player.streak} / 7 DÍAS</span></div><div className="day-grid">{[1,2,3,4,5,6,7].map(day => <div key={day} className={`day-item ${day <= player.streak ? 'complete' : ''} ${day === 7 ? 'jackpot' : ''}`}><span>DÍA {day}</span>{day <= player.streak ? <Check /> : day === 7 ? <Gift /> : <Leaf />}<strong>+10</strong><small>créditos</small></div>)}</div><Button onClick={() => action('checkin')} disabled={busy || checked}>{checked ? <><Check /> BONUS RECLAMADO</> : <><Gift /> RECLAMAR BONUS DE HOY</>}</Button></section>
    <div className="section-heading task-heading"><h2>Hustle board</h2><span>ON-CHAIN & SOCIAL</span></div><div className="task-list"><Task icon={<Wallet />} title="Hold $DOGG. Representa al hood." subtitle="Conecta tu wallet para consultar tu stash on-chain." reward="ON-CHAIN"><Button asChild variant="outline"><Link to="/perfil">{wallet ? 'Ver mi saldo' : 'Conectar wallet'}<ArrowUpRight /></Link></Button></Task><Task icon={<Users />} title="Invita a tus homies" subtitle="El grow es mejor cuando crecemos juntos." reward="REFERIDOS"><Button asChild variant="outline"><Link to="/amigos">Invitar <ArrowRight /></Link></Button></Task><Task icon={<Music2 />} title="Representa a DOGG en redes" subtitle={socialStart ? 'Tiempo de espera · la verificación social aún no está activada.' : 'Temporizador de ejemplo. Recompensa pendiente de verificación.'} reward="24H"><Button variant="outline" onClick={() => { haptic(); setSocialStart(Date.now()); }} disabled={Boolean(socialStart)}>{socialStart ? <Countdown elapsed={now-socialStart} /> : 'Iniciar tarea'}<Clock3 /></Button></Task></div><Arcade /></>;
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
export function GrowOps() {
  const { player, demo, busy, activateMiner } = useDogg();
  const current = getMiner(player.minerId).category;
  const [tier, setTier] = useState<string>(MINER_TIERS.includes(current as never) ? current : MINER_TIERS[0]);
  return <><div className="screen-head"><h1>Aumentar velocidad de minería</h1><p>Tu rango sigue al $DOGG minado en la app más tu hold on-chain.</p></div><PnlChart /><h2 className="vault-h">Paquetes de velocidad</h2>
    <div className="grow-notice"><ShieldCheck /><span>{demo ? 'Demo · requisitos basados en créditos de prueba. Los saldos de wallet son independientes.' : player.walletAddress ? `Wallet vinculada · ${(player.hold ?? 0).toLocaleString('de-DE')} $DOGG en hold desbloquean tus mineros.` : 'Conecta tu wallet en Billetera para que tu $DOGG desbloquee mineros.'}</span></div>
    <div className="tier-tabs" role="tablist">{MINER_TIERS.map((t, i) => <button key={t} role="tab" aria-selected={tier === t} className={`rank-${i + 1} ${tier === t ? 'active' : ''}`} onClick={() => { haptic(); setTier(t); }}><small>NIVEL {i * 50 + 1}–{i * 50 + 50}</small>{t}</button>)}</div><p className="tier-count">{MINERS.length} mineros · 10 rangos</p>
    {[tier].map(category => <section key={category} className="miner-category"><div className="section-heading"><h2>{category}</h2><span className="text-gold">WEST COAST 420</span></div><div className="grow-grid">{MINERS.filter(m => m.category === category).map(miner => {
      const active = player.minerId === miner.id;
      const eligible = miner.hold === 0 || player.balance + (demo ? 0 : player.hold ?? 0) >= miner.hold;
      return <article key={miner.id} className={`grow-card rank-${MINER_TIERS.indexOf(category as never) + 1} ${active ? 'owned' : ''}`} aria-label={miner.name}>
        <div className="flex justify-between"><span className="eyebrow">{category.toUpperCase()}</span>{active ? <Check className="text-primary" size={16} /> : !eligible ? <LockKeyhole className="text-muted-foreground" size={16} /> : <Sprout className="text-primary" size={16} />}</div>
        <div className={`grow-art tier-art ${active ? 'live' : 'idle'}`}>{active ? <video src={TIER_CLIP[MINER_TIERS.indexOf(category as never)]} poster={TIER_ART[MINER_TIERS.indexOf(category as never)]} autoPlay muted loop playsInline preload="auto" aria-label={`${category}: DOGG regando su planta`} /> : <img src={TIER_ART[MINER_TIERS.indexOf(category as never)] ?? TIER_ART[0]} alt={`${category}: DOGG regando su planta`} loading="lazy" />}</div>
        <h2>{miner.name}</h2><div className="grow-stats"><div><span>Potencia</span><strong><Zap size={15} /> {miner.power} <small>TH/s</small></strong></div><div><span>Producción diaria</span><strong>{miner.daily} <small>$DOGG/d</small></strong></div></div>
        <div className="hold-requirement"><Wallet />{miner.hold === 0 ? 'Disponible para todos' : `Hold: ${miner.hold.toLocaleString('de-DE')} $DOGG`}</div>
        <Button variant={active ? 'default' : 'outline'} className="miner-state-button w-full" disabled={busy || active || !eligible || miner.daily < getMiner(player.minerId).daily} onClick={() => void activateMiner(miner.id)}>{active ? <><Check /> MINANDO AHORA</> : eligible ? (miner.daily < getMiner(player.minerId).daily ? 'ALCANZADO' : 'MINAR') : `MANTÉN ${miner.hold.toLocaleString('de-DE')} $DOGG`}</Button>
      </article>;
    })}</div></section>)}
  </>;
}

