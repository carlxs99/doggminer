import { ClientOnly, Link, useLocation } from '@tanstack/react-router';
import { Suspense, lazy, useEffect, useState, type ReactNode } from 'react';
import { setSound, soundOn, scratch } from '@/lib/fx';
import { Leaf, Cigarette, Radio, Zap, Users, Wallet, Crown, ArrowUpRight, Volume2, VolumeX, CircleHelp, Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useDogg } from './state';
import { Logo } from './hero';
import { haptic, JETTON, SWAP, PRICE } from '@/lib/dogg';
import { toast } from 'sonner';
const TonWallet = lazy(() => import('./ton-wallet'));
const FAQ: [string, string][] = [
  ['¿Cómo mino $DOGG?', 'Pulsa "Prende el turno" en el Humero. Durante 24 h acumulas $DOGG según la potencia de tu minero; al terminar, cóbralo y empieza otro.'],
  ['¿Cómo desbloqueo mejores mineros?', 'Cada minero pide un hold mínimo. Cuenta el $DOGG de tu wallet verificada más lo minado en la app. Si tu saldo baja, tu minero baja al nivel que cubras.'],
  ['¿Por qué tengo que firmar al conectar la wallet?', 'Es una firma gratuita que no mueve fondos. Demuestra que la wallet es tuya para que nadie use la de otro.'],
  ['¿Cómo retiro?', 'En la Billetera, desde 1.000 $DOGG. La comisión es de 70 $DOGG y el envío llega a tu wallet verificada en unos minutos.'],
  ['¿Qué es el modo demo?', 'Fuera de Telegram puedes probar la app con créditos de prueba que se reinician al recargar y no son tokens reales.'],
];
const navigation = [
  { to: '/', name: 'Minar', subtitle: 'El Humero', icon: Cigarette },
  { to: '/trabajos', name: 'Tareas', subtitle: 'Haz moves. Gana DOGG.', icon: Radio },
  { to: '/grow-ops', name: 'Boost', subtitle: 'Sube tu potencia', icon: Zap },
  { to: '/amigos', name: 'Amigos', subtitle: 'Tu crew', icon: Users },
  { to: '/perfil', name: 'Perfil', subtitle: 'Wallet y retiros', icon: Crown },
] as const;
export function Shell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { player, demo, name, wallet, openWallet } = useDogg();
  const [sound, setSoundState] = useState(false);
  useEffect(() => setSoundState(soundOn()), []);
  const [welcome, setWelcome] = useState(false);
  useEffect(() => { try { if (!localStorage.getItem('dogg-welcome')) setWelcome(true); } catch { /* storage blocked */ } }, []);
  const closeWelcome = () => { try { localStorage.setItem('dogg-welcome', '1'); } catch { /* ignore */ } setWelcome(false); haptic(); };
  const toggleSound = () => { const next = !sound; setSound(next); setSoundState(next); if (next) scratch(); haptic(); };
  return <div className={`app-layout ${player.shiftStartedAt ? "shift-on" : ""}`}>
    <div className="smoke-layer" aria-hidden="true"><i /><i /><i /></div>
    <ClientOnly><Suspense fallback={null}><TonWallet /></Suspense></ClientOnly>
    <aside className="sidebar">
      <Link to="/" className="brand"><span className="brand-symbol"><Leaf /></span><span>$DOGG<span className="text-primary"> MINER</span><small>WEST COAST MINING CLUB</small></span></Link>
      <div className="sidebar-label">WELCOME TO THE HOOD</div>
      <nav>{navigation.map(({ to, name, subtitle, icon: Icon }) => <Button key={to} asChild variant="ghost" className={`side-link ${pathname === to ? 'selected' : ''}`}><Link to={to} onClick={haptic}><Icon /><span>{name}<small>{subtitle}</small></span>{pathname === to && <span className="active-dot" />}</Link></Button>)}</nav>
      <div className="sidebar-bottom"><div className="club-stamp"><Leaf /><span>GROW TOGETHER.<br />STAY HIGHER.</span></div><span className="network"><i /> TON NETWORK <span>v.1.0</span></span><div className="sidebar-user"><span className="avatar">{name[0]}</span><span>{name}<small>Rookie del hood</small></span><ArrowUpRight size={17} /></div></div>
    </aside>
    <div className="main-shell"><header className="topbar"><Link to="/" className="mobile-brand" aria-label="$DOGG MINER, inicio"><Logo /></Link><div className="breadcrumb">EL CLUB <span>/</span> <strong>{navigation.find(n => n.to === pathname)?.name.toUpperCase()}</strong></div><div className="header-actions"><Button variant="ghost" size="icon" className="sound-toggle" aria-label={sound ? "Silenciar sonidos" : "Activar sonidos"} onClick={toggleSound}>{sound ? <Volume2 /> : <VolumeX />}</Button><span className="demo-tag">{demo ? 'MODO DEMO' : 'TELEGRAM'}</span><Button variant="outline" className="wallet-connect" onClick={() => openWallet?.()} disabled={!openWallet}><Wallet /><span className="wallet-label">{wallet ? `${wallet.slice(0, 5)}…${wallet.slice(-4)}` : 'Conectar wallet'}</span><ArrowUpRight /></Button></div></header>
      <main key={pathname} className="page-enter">{children}</main>
      <footer className="page-footer"><span><i /> POWERED BY TON. BUILT FOR THE HOOD.</span><Dialog><DialogTrigger asChild><Button variant="ghost" size="sm"><CircleHelp /> Ayuda y enlaces</Button></DialogTrigger><DialogContent className="help-dialog"><DialogHeader><DialogTitle>Ayuda · $DOGG MINER</DialogTitle></DialogHeader>
        <div className="faq">{FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
        <div className="help-contract"><small>Contrato oficial $DOGG</small><button onClick={() => void navigator.clipboard.writeText(JETTON).then(() => toast.success('Contrato copiado')).catch(() => toast.error('No se pudo copiar'))}><code>{JETTON.slice(0, 8)}…{JETTON.slice(-6)}</code><Copy /></button></div>
        <div className="help-links"><a href={`https://tonviewer.com/${JETTON}`} target="_blank" rel="noopener">Explorador TON <ExternalLink /></a><a href={PRICE} target="_blank" rel="noopener">Precio <ExternalLink /></a><a href={SWAP} target="_blank" rel="noopener">Comprar <ExternalLink /></a><a href="https://t.me/Doggminerbot" target="_blank" rel="noopener">Bot oficial <ExternalLink /></a></div>
      </DialogContent></Dialog></footer>
    </div>
    <Dialog open={welcome} onOpenChange={o => { if (!o) closeWelcome(); }}><DialogContent className="welcome-dialog"><DialogHeader><DialogTitle>Bienvenido al hood</DialogTitle></DialogHeader>
      <ol className="welcome-steps"><li><strong>Mina</strong><span>Prende tu turno de 24 h en el Humero y cobra al terminar.</span></li><li><strong>Sube de minero</strong><span>Conecta tu wallet: tu $DOGG en hold desbloquea mineros más potentes en Grow Ops.</span></li><li><strong>Retira</strong><span>Desde 1.000 $DOGG, directo a tu wallet verificada.</span></li></ol>
      <Button className="start-shift" onClick={closeWelcome}>Vamos allá</Button></DialogContent></Dialog>
    <nav className="bottom-nav">{navigation.map(({ to, name, icon: Icon }) => <Button asChild variant="ghost" key={to} className={pathname === to ? 'selected' : ''}><Link to={to} onClick={haptic}><Icon /><span>{name}</span></Link></Button>)}</nav>
  </div>;
}