import { ClientOnly, Link, useLocation } from '@tanstack/react-router';
import { Suspense, lazy, useEffect, useState, type ReactNode } from 'react';
import { setSound, soundOn, scratch } from '@/lib/fx';
import { Leaf, Cigarette, Radio, Sprout, Wallet, Link2, Crown, ArrowUpRight, Volume2, VolumeX, CircleHelp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useDogg } from './state';
import { haptic } from '@/lib/dogg';
const TonWallet = lazy(() => import('./ton-wallet'));
const navigation = [
  { to: '/', name: 'Humero', subtitle: 'Tu zona de minado', icon: Cigarette },
  { to: '/trabajos', name: 'Trabajos', subtitle: 'Haz moves. Gana DOGG.', icon: Radio },
  { to: '/grow-ops', name: 'Grow Ops', subtitle: 'Sube tu potencia', icon: Sprout },
  { to: '/billetera', name: 'Billetera', subtitle: 'Tu stash, a salvo', icon: Link2 },
  { to: '/perfil', name: 'Mi hood', subtitle: 'Tu perfil y tus homies', icon: Crown },
] as const;
export function Shell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { player, demo, name, wallet, openWallet } = useDogg();
  const [sound, setSoundState] = useState(false);
  useEffect(() => setSoundState(soundOn()), []);
  const toggleSound = () => { const next = !sound; setSound(next); setSoundState(next); if (next) scratch(); haptic(); };
  return <div className={`app-layout ${player.shiftStartedAt ? "shift-on" : ""}`}>
    <div className="smoke-layer" aria-hidden="true"><i /><i /><i /></div>
    <ClientOnly><Suspense fallback={null}><TonWallet /></Suspense></ClientOnly>
    <aside className="sidebar">
      <Link to="/" className="brand"><span className="brand-symbol"><Leaf /></span><span>DOGG<span className="text-primary">HOUSE</span><small>WEST COAST MINING CLUB</small></span></Link>
      <div className="sidebar-label">WELCOME TO THE HOOD</div>
      <nav>{navigation.map(({ to, name, subtitle, icon: Icon }) => <Button key={to} asChild variant="ghost" className={`side-link ${pathname === to ? 'selected' : ''}`}><Link to={to} onClick={haptic}><Icon /><span>{name}<small>{subtitle}</small></span>{pathname === to && <span className="active-dot" />}</Link></Button>)}</nav>
      <div className="sidebar-bottom"><div className="club-stamp"><Leaf /><span>GROW TOGETHER.<br />STAY HIGHER.</span></div><span className="network"><i /> TON NETWORK <span>v.1.0</span></span><div className="sidebar-user"><span className="avatar">{name[0]}</span><span>{name}<small>Rookie del hood</small></span><ArrowUpRight size={17} /></div></div>
    </aside>
    <div className="main-shell"><header className="topbar"><span className="mobile-brand"><Leaf /> DOGG<span>HOUSE</span></span><div className="breadcrumb">EL CLUB <span>/</span> <strong>{navigation.find(n => n.to === pathname)?.name.toUpperCase()}</strong></div><div className="header-actions"><Button variant="ghost" size="icon" className="sound-toggle" aria-label={sound ? "Silenciar sonidos" : "Activar sonidos"} onClick={toggleSound}>{sound ? <Volume2 /> : <VolumeX />}</Button><span className="demo-tag">{demo ? 'MODO DEMO' : 'TELEGRAM'}</span><Button variant="outline" className="wallet-connect" onClick={() => openWallet?.()} disabled={!openWallet}><Wallet />{wallet ? `${wallet.slice(0, 5)}…${wallet.slice(-4)}` : 'Conectar wallet'}<ArrowUpRight /></Button></div></header>
      <main>{children}</main>
      <footer className="page-footer"><span><i /> POWERED BY TON. BUILT FOR THE HOOD.</span><Dialog><DialogTrigger asChild><Button variant="ghost" size="sm"><CircleHelp /> Sobre el club</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>DOGG HOUSE</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">Club de minado inspirado en la cultura West Coast. Los créditos de juego no son tokens en tu billetera. En modo demo, el avance se reinicia al recargar. Los pagos on-chain todavía no están activados. Las tasas, niveles y premios son valores de ejemplo.</p></DialogContent></Dialog></footer>
    </div>
    <nav className="bottom-nav">{navigation.map(({ to, name, icon: Icon }) => <Button asChild variant="ghost" key={to} className={pathname === to ? 'selected' : ''}><Link to={to} onClick={haptic}><Icon /><span>{name}</span></Link></Button>)}</nav>
  </div>;
}