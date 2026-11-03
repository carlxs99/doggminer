import { ClientOnly, Link, useLocation, useRouter } from '@tanstack/react-router';
import { Suspense, lazy, useEffect, useState, type ReactNode } from 'react';
import { setSound, soundOn, scratch } from '@/lib/fx';
import { Leaf, Cigarette, Radio, Zap, Users, Wallet, Crown, ArrowUpRight, Volume2, VolumeX, CircleHelp, Copy, ExternalLink, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useDogg } from './state';
import { Logo, bustArt, bustCapArt, leafArt } from './hero';
import { Splash } from './splash';
import { BuyDedustLink } from './buy';
import { LangSwitcher, useT } from './lang';
import { haptic, JETTON, SWAP, PRICE } from '@/lib/dogg';
import type { Key } from '@/lib/i18n';
import { toast } from 'sonner';
const TonWallet = lazy(() => import('./ton-wallet'));
const FAQ: [Key, Key][] = [['faq.q1', 'faq.a1'], ['faq.q2', 'faq.a2'], ['faq.q3', 'faq.a3'], ['faq.q4', 'faq.a4'], ['faq.q5', 'faq.a5']];
const navigation = [
  { to: '/', name: 'nav.mine', subtitle: 'nav.mine.sub', icon: Cigarette },
  { to: '/trabajos', name: 'nav.tasks', subtitle: 'nav.tasks.sub', icon: Radio },
  { to: '/grow-ops', name: 'nav.boost', subtitle: 'nav.boost.sub', icon: Zap },
  { to: '/amigos', name: 'nav.friends', subtitle: 'nav.friends.sub', icon: Users },
  { to: '/perfil', name: 'nav.profile', subtitle: 'nav.profile.sub', icon: Crown },
] as const satisfies readonly { to: string; name: Key; subtitle: Key; icon: unknown }[];
export function Shell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const router = useRouter();
  // Warm every screen (code + header art) right after the app opens, so switching tabs is instant.
  useEffect(() => {
    const warm = () => {
      for (const { to } of navigation) void router.preloadRoute({ to }).catch(() => undefined);
      for (const src of [bustArt, bustCapArt, leafArt]) { const img = new Image(); img.decoding = 'async'; img.src = src; }
    };
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(warm, { timeout: 1500 }); else setTimeout(warm, 800);
  }, [router]);
  const { player, demo, name, wallet, openWallet, isAdmin } = useDogg();
  const t = useT();
  const [sound, setSoundState] = useState(false);
  useEffect(() => setSoundState(soundOn()), []);
  const [welcome, setWelcome] = useState(false);
  useEffect(() => { try { if (!localStorage.getItem('dogg-welcome')) setWelcome(true); } catch { /* storage blocked */ } }, []);
  const closeWelcome = () => { try { localStorage.setItem('dogg-welcome', '1'); } catch { /* ignore */ } setWelcome(false); haptic(); };
  const toggleSound = () => { const next = !sound; setSound(next); setSoundState(next); if (next) scratch(); haptic(); };
  const crumb = pathname === '/admin' ? t('nav.admin') : (() => { const n = navigation.find(x => x.to === pathname); return n ? t(n.name).toUpperCase() : ''; })();
  return <div className={`app-layout ${player.shiftStartedAt ? "shift-on" : ""}`}>
    <Splash />
    <div className="smoke-layer" aria-hidden="true"><i /><i /><i /></div>
    <ClientOnly><Suspense fallback={null}><TonWallet /></Suspense></ClientOnly>
    <aside className="sidebar">
      <Link to="/" className="brand"><span className="brand-symbol"><Leaf /></span><span>$DOGG<span className="text-primary"> MINER</span><small>WEST COAST MINING CLUB</small></span></Link>
      <div className="sidebar-label">WELCOME TO THE HOOD</div>
      <nav>{navigation.map(({ to, name: label, subtitle, icon: Icon }) => <Button key={to} asChild variant="ghost" className={`side-link ${pathname === to ? 'selected' : ''}`}><Link to={to} onClick={haptic}><Icon /><span>{t(label)}<small>{t(subtitle)}</small></span>{pathname === to && <span className="active-dot" />}</Link></Button>)}</nav>
      <div className="sidebar-bottom"><div className="club-stamp"><Leaf /><span>GROW TOGETHER.<br />STAY HIGHER.</span></div><span className="network"><i /> TON NETWORK <span>v.1.0</span></span><div className="sidebar-user"><span className="avatar">{name[0]}</span><span>{name}<small>{t('shell.rookie')}</small></span><ArrowUpRight size={17} /></div></div>
    </aside>
    <div className="main-shell"><header className="topbar"><Link to="/" className="mobile-brand" aria-label={t('shell.home')}><Logo /></Link><div className="breadcrumb">{t('shell.club')} <span>/</span> <strong>{crumb}</strong></div><div className="header-actions">{isAdmin && <Button asChild variant="ghost" size="icon" className={`admin-toggle ${pathname === '/admin' ? 'selected' : ''}`}><Link to="/admin" aria-label={t('shell.admin')} onClick={haptic}><ShieldCheck /></Link></Button>}<Button variant="ghost" size="icon" className="sound-toggle" aria-label={sound ? t('shell.soundOff') : t('shell.soundOn')} onClick={toggleSound}>{sound ? <Volume2 /> : <VolumeX />}</Button><LangSwitcher /><span className="demo-tag">{demo ? '' : 'TELEGRAM'}</span><Button variant="outline" className="wallet-connect" onClick={() => openWallet?.()} disabled={!openWallet} aria-label={wallet ? undefined : t('shell.connect')}><Wallet /><span className="wallet-label">{wallet ? `${wallet.slice(0, 5)}…${wallet.slice(-4)}` : t('shell.connect')}</span><ArrowUpRight /></Button></div></header>
      <main key={pathname} className="page-enter">{children}</main>
      <footer className="page-footer"><span><i /> POWERED BY TON. BUILT FOR THE HOOD.</span><Dialog><DialogTrigger asChild><Button variant="ghost" size="sm"><CircleHelp /> {t('shell.help')}</Button></DialogTrigger><DialogContent className="help-dialog"><DialogHeader><DialogTitle>{t('shell.helpTitle')}</DialogTitle></DialogHeader>
        <div className="faq">{FAQ.map(([q, a]) => <details key={q}><summary>{t(q)}</summary><p>{t(a)}</p></details>)}</div>
        <div className="help-contract"><small>{t('shell.contract')}</small><button onClick={() => void navigator.clipboard.writeText(JETTON).then(() => toast.success(t('shell.contractCopied'))).catch(() => toast.error(t('shell.copyFail')))}><code>{JETTON.slice(0, 8)}…{JETTON.slice(-6)}</code><Copy /></button></div>
        <div className="help-links"><a href={`https://tonviewer.com/${JETTON}`} target="_blank" rel="noopener">{t('shell.explorer')} <ExternalLink /></a><a href={PRICE} target="_blank" rel="noopener">{t('shell.price')} <ExternalLink /></a><BuyDedustLink>{t('shell.buy')} <ExternalLink /></BuyDedustLink><a href={SWAP} target="_blank" rel="noopener">{t('shell.dedustWeb')} <ExternalLink /></a><a href="https://t.me/Doggminerbot" target="_blank" rel="noopener">{t('shell.bot')} <ExternalLink /></a></div>
      </DialogContent></Dialog></footer>
    </div>
    <Dialog open={welcome} onOpenChange={o => { if (!o) closeWelcome(); }}><DialogContent className="welcome-dialog"><DialogHeader><DialogTitle>{t('welcome.title')}</DialogTitle></DialogHeader>
      <ol className="welcome-steps"><li><strong>{t('welcome.s1')}</strong><span>{t('welcome.s1d')}</span></li><li><strong>{t('welcome.s2')}</strong><span>{t('welcome.s2d')}</span></li><li><strong>{t('welcome.s3')}</strong><span>{t('welcome.s3d')}</span></li></ol>
      <Button className="start-shift" onClick={closeWelcome}>{t('welcome.go')}</Button></DialogContent></Dialog>
    <nav className="bottom-nav">{navigation.map(({ to, name: label, icon: Icon }) => <Button asChild variant="ghost" key={to} className={pathname === to ? 'selected' : ''}><Link to={to} onClick={haptic}><Icon /><span>{t(label)}</span></Link></Button>)}</nav>
  </div>;
}
