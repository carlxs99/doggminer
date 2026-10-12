import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, ArrowDownLeft, Wallet, RefreshCw, Copy, Check, ShieldCheck, Zap, LogOut, Info, Pickaxe, Gift, Users, Trophy, Percent, Share2, Smartphone, LineChart } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDogg, WITHDRAW_FEE, WITHDRAW_MIN, type Entry } from './state';
import { Title } from './screens';
import { JETTON, SWAP, PRICE, formatDogg, haptic } from '@/lib/dogg';
import { MINERS, getMiner } from '@/lib/mining';
import coin from '@/assets/dogg-coin.png';
import mascot from '@/assets/dogg-mascot.jpg';

const Coin = ({ size = 16 }: { size?: number }) => <img src={coin} width={size} height={size} alt="" className="inline-coin" />;
const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;
const levelFor = (total: number) => MINERS.reduce((lvl, m) => (m.hold <= total ? m.level : lvl), 1);
function ago(at: number, now: number) { const m = Math.max(0, Math.floor((now - at) / 60000)); return m < 1 ? 'ahora' : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.floor(m / 60)} h` : `hace ${Math.floor(m / 1440)} d`; }

function useOnchain(wallet: string | null, refresh: number) {
  const [balances, setBalances] = useState<{ ton: number; dogg: number } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!wallet) { setBalances(null); return; }
    let active = true; setLoading(true); setError('');
    Promise.all([fetch(`https://tonapi.io/v2/accounts/${encodeURIComponent(wallet)}`), fetch(`https://tonapi.io/v2/accounts/${encodeURIComponent(wallet)}/jettons`)]).then(async rs => {
      for (const r of rs) if (!r.ok) throw new Error('No se pudieron consultar los saldos. Inténtalo de nuevo.');
      const [account, jettons] = await Promise.all(rs.map(r => r.json()));
      // Raw form of JETTON, precomputed — avoids pulling @ton/core (needs Buffer) into the browser.
      const target = '0:a74ffea7ade24751ac5b670ee0eb88243f9bf1e8bbd25d615ba16e6d62c0a92d';
      const j = jettons.balances?.find((b: { jetton: { address: string } }) => b.jetton.address === target);
      if (active) setBalances({ ton: Number(account.balance) / 1e9, dogg: j ? Number(j.balance) / 10 ** Number(j.jetton.decimals) : 0 });
    }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [wallet, refresh]);
  return { balances, error, loading };
}

export function Billetera() {
  const { wallet, openWallet, player, history, withdraw, now, busy, demo } = useDogg();
  const [refresh, setRefresh] = useState(0);
  const [amount, setAmount] = useState('');
  const { balances, error, loading } = useOnchain(wallet, refresh);
  const onchain = balances?.dogg ?? 0;
  const total = player.balance + onchain;
  const level = levelFor(total);
  const week = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(now || 0); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (6 - i)); return { start: d.getTime(), mining: 0, team: 0, bonus: 0 }; });
    for (const e of history) { if (e.amount <= 0) continue; const d = [...days].reverse().find(x => e.at >= x.start); if (!d) continue; if (e.kind === 'mining') d.mining += e.amount; else if (e.kind === 'team') d.team += e.amount; else d.bonus += e.amount; }
    return days;
  }, [history, now]);
  const sum = (k: 'mining' | 'team' | 'bonus') => week.reduce((a, d) => a + d[k], 0);
  const weekTotal = sum('mining') + sum('team') + sum('bonus');
  const max = Math.max(1, ...week.map(d => d.mining + d.team + d.bonus));
  const todayGain = week[6] ? week[6].mining + week[6].team + week[6].bonus : 0;
  const dayName = (t: number, i: number) => i === 6 ? 'Hoy' : new Date(t).toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '');
  return <><Title label="LA BÓVEDA" title="Your keys." accent="Your stash" description="Tu tenencia, tus cobros y tu historial en un solo sitio." />
    <section className="vault-card">
      <img src={coin} alt="" className="vault-watermark" />
      <span className="eyebrow">TENENCIA TOTAL · DECIDE TU NIVEL</span>
      <div className="vault-total"><Coin size={34} />{formatDogg(total)}</div>
      <span className="vault-level"><Coin size={14} /> Nivel {level} · {getMiner(level === 1 ? 'rookie-1' : `miner-${level}`).name}</span>
      <div className="vault-split"><div><span><Pickaxe /> En la app</span><strong>{formatDogg(player.balance)}</strong></div><div><span><Wallet /> On-chain {wallet && <button aria-label="Actualizar saldo on-chain" onClick={() => setRefresh(r => r + 1)}><RefreshCw className={loading ? 'animate-spin' : ''} /></button>}</span><strong>{loading ? '…' : wallet ? formatDogg(onchain) : '—'}</strong></div></div>
    </section>

    <h2 className="vault-h">Billetera TON</h2>
    <section className="vault-row">
      <span className="vault-icon"><Wallet /></span>
      <div><strong>{wallet ? 'Conectada' : 'Sin conectar'}</strong>{wallet ? <button className="vault-addr" onClick={() => void navigator.clipboard.writeText(wallet).then(() => toast.success('Dirección copiada')).catch(() => toast.error('No se pudo copiar'))}>{short(wallet)} <Copy /></button> : <small>Conecta para ver tu stash on-chain</small>}</div>
      <Button size="icon" variant={wallet ? 'outline' : 'default'} aria-label={wallet ? 'Desconectar wallet' : 'Conectar wallet'} onClick={() => openWallet?.()} disabled={!openWallet}>{wallet ? <LogOut /> : <ArrowUpRight />}</Button>
    </section>
    {balances && <p className="vault-note">TON: {balances.ton.toLocaleString('en-US', { maximumFractionDigits: 4 })}</p>}
    {error && <p role="alert" className="text-destructive text-sm mt-2">{error}</p>}
    <section className="vault-verify">
      <div className="vault-verify-head"><span className="vault-icon"><ShieldCheck /></span><div><strong>{player.walletAddress ? 'Billetera vinculada' : 'Billetera sin vincular'}</strong><small>Tu hold real ({formatDogg(player.hold ?? 0)} $DOGG) + lo minado en la app desbloquean mineros. Se comprueba al activar y al cobrar.</small></div></div>
      <ul><li className={wallet ? 'ok' : ''}><Check /> Billetera conectada</li><li className={player.walletAddress ? 'ok' : ''}><Check /> Firma de propiedad {player.walletAddress ? '' : <em>{demo ? 'solo en Telegram' : 'reconecta para firmar'}</em>}</li></ul>
    </section>

    <h2 className="vault-h">Comprar <Coin size={20} /></h2>
    <div className="vault-buy"><a href={SWAP} target="_blank" rel="noopener noreferrer" className="buy-swap"><RefreshCw /><strong>DeDust</strong><small>Cambiar TON → $DOGG</small></a><a href={PRICE} target="_blank" rel="noopener noreferrer" className="buy-chart"><LineChart /><strong>Gráfico en vivo</strong><small>Precio de $DOGG</small></a></div>
    <p className="vault-info"><Info /> Los $DOGG que compras se quedan en tu billetera y cuentan para tu nivel. Ahora estás en el nivel {level}. Vender hace que bajes de nivel.</p>

    <h2 className="vault-h">Retirar</h2>
    <section className="vault-withdraw"><div><strong>Envía tus <Coin /> de la app a tu billetera</strong><small>Mín. {WITHDRAW_MIN.toLocaleString('en-US')} · comisión {WITHDRAW_FEE} <Coin size={12} /></small></div>
      <form onSubmit={e => { e.preventDefault(); void withdraw(Number(amount)).then(() => setAmount('')); }}><Input inputMode="decimal" type="number" min={WITHDRAW_MIN} placeholder={`${WITHDRAW_MIN}`} value={amount} onChange={e => setAmount(e.target.value)} aria-label="Cantidad a retirar" /><Button type="submit" disabled={busy}><ArrowUpRight /> Retirar</Button></form></section>

    <h2 className="vault-h">Nómina</h2>
    <section className="vault-payroll"><div className="payroll-top"><div><span className="eyebrow">GANADO ESTA SEMANA</span><strong>{formatDogg(weekTotal)} <Coin size={18} /></strong></div><span className="payroll-today"><small>Hoy</small>+{Math.round(todayGain)}</span></div>
      <div className="payroll-chart">{week.map((d, i) => <div key={d.start} className={i === 6 ? 'today' : ''}><div className="bar">{(['bonus', 'team', 'mining'] as const).map(k => <span key={k} className={k} style={{ height: `${d[k] / max * 100}%` }} />)}</div><small>{dayName(d.start, i)}</small></div>)}</div>
      <div className="payroll-legend"><div><i className="mining" /> Minería<strong>{Math.round(sum('mining'))}</strong></div><div><i className="team" /> Equipo<strong>{Math.round(sum('team'))}</strong></div><div><i className="bonus" /> Bono<strong>{Math.round(sum('bonus'))}</strong></div></div></section>

    <h2 className="vault-h"><ShieldCheck /> Tablón de pagos</h2>
    <section className="vault-list empty"><ArrowUpRight /><p>Aún no hay retiros verificados on-chain. Aquí aparecerán los cobros reales con su enlace a la blockchain.</p></section>

    <h2 className="vault-h">Historial</h2>
    <section className="vault-list">{history.length === 0 ? <p className="vault-empty">Todavía no hay movimientos. Reclama tu bonus diario o termina un turno.</p> : history.map((e: Entry) => <div key={e.at + e.label} className="vault-item"><span className={`vault-icon ${e.kind}`}>{e.kind === 'mining' ? <Pickaxe /> : e.kind === 'withdraw' ? <ArrowUpRight /> : e.kind === 'team' ? <Users /> : <Gift />}</span><div><strong>{e.kind === 'task' ? 'Premio de tarea' : e.label}</strong><small>{e.kind === 'task' ? `${e.label} · ` : ''}{ago(e.at, now)}</small></div><div className="vault-amount"><strong className={e.amount < 0 ? 'neg' : ''}>{e.amount > 0 ? '+' : ''}{formatDogg(e.amount)} <Coin size={14} /></strong>{e.status === 'review' && <em>En revisión</em>}</div></div>)}</section>

    <div className="token-contract"><span className="eyebrow">CONTRATO DEL JETTON</span><code>{JETTON}</code><span><ShieldCheck /> Jetton no verificado · comprueba el contrato antes de operar.</span></div>
  </>;
}

export function Perfil() {
  const { name, player, demo, wallet, history } = useDogg();
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<'team' | 'top'>('team');
  const miner = getMiner(player.minerId);
  const mined = history.filter(e => e.kind === 'mining').reduce((a, e) => a + e.amount, 0);
  const id = typeof window !== 'undefined' ? window.Telegram?.WebApp?.initDataUnsafe?.user?.id : undefined;
  const bot = (import.meta.env['VITE_TELEGRAM_BOT_USERNAME'] as string | undefined) ?? 'Doggminerbot';
  const link = id && bot ? `https://t.me/${bot}?startapp=ref_${id}` : null;
  const initials = name.slice(0, 2).toUpperCase();
  async function copy() { haptic(); if (!link) { toast.info('Los referidos se activarán al configurar el bot de Telegram.'); return; } try { await navigator.clipboard.writeText(link); setCopied(true); toast.success('Invitación copiada'); } catch { toast.error('No se pudo copiar la invitación'); } }
  function share() { haptic(); if (!link) { toast.info('Los referidos se activarán al configurar el bot de Telegram.'); return; } const url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Únete a mi crew en DOGG HOUSE 🌱')}`; const tg = window.Telegram?.WebApp; if (tg?.openTelegramLink) tg.openTelegramLink(url); else window.open(url, '_blank', 'noopener'); }
  return <><Title label="TU REPUTACIÓN" title="Real ones." accent="Real respect" description="Tu nombre en el hood. Tu legado en DOGG." />
    <section className="credential">
      <span className="eyebrow">DOGG HOUSE · CREDENCIAL DEL HOOD</span>
      <div className="credential-body"><span className="credential-avatar">{initials}</span><div><h2>{name}</h2><div className="credential-tags"><span className="tag-gold">Nv {miner.level || 1}</span><span>{miner.category}</span></div><span className={`credential-wallet ${wallet ? 'ok' : ''}`}><Wallet /> {wallet ? 'Billetera' : 'Sin billetera'}</span><strong className="credential-rank">{miner.name}</strong></div><img src={mascot} alt="" width={120} height={120} /></div>
      {demo && <small className="credential-demo">Modo demo</small>}
    </section>
    <div className="profile-stats four"><div><Pickaxe /><span>MINADO</span><strong>{Math.round(mined)}</strong></div><div><Trophy /><span>MÁX.</span><strong>Nv {miner.level || 1}</strong></div><div><Users /><span>RECLUTAS</span><strong>0</strong></div><div><Zap /><span>RACHA</span><strong>{player.streak}</strong></div></div>

    <h2 className="vault-h">Recluta homies</h2>
    <section className="crew-card">
      <h3>¡Arma tu crew!</h3>
      <div className="crew-perk"><Gift /><strong>+100 <Coin size={14} /></strong> por cada recluta que CALIFIQUE</div>
      <div className="crew-perk"><Percent /> <span><strong>10%</strong> de todo lo que minen tus reclutas, para siempre</span></div>
      <div className="crew-link"><span>{link ?? 'Enlace disponible al abrir desde Telegram'}</span><Button size="icon" variant="ghost" aria-label="Copiar enlace" onClick={() => void copy()}>{copied ? <Check /> : <Copy />}</Button></div>
      <Button className="crew-invite" onClick={share}><Share2 /> Invitar homies</Button>
      <small>Tu propia billetera debe estar verificada para reclamar premios.</small>
    </section>
    <div className="crew-claims"><section><h3>Bono de reclutamiento</h3><small>0 calificados · 0 reclamados</small><strong><Coin size={20} /> 0</strong><Button variant="outline" disabled>Reclamar</Button></section><section><h3>Comisión del crew</h3><small>0 mineros verificados</small><strong><Coin size={20} /> 0</strong><Button disabled>Reclamar</Button></section></div>

    <div className="crew-tabs" role="tablist"><button role="tab" aria-selected={tab === 'team'} className={tab === 'team' ? 'active' : ''} onClick={() => setTab('team')}><Users /> Mi crew (0)</button><button role="tab" aria-selected={tab === 'top'} className={tab === 'top' ? 'active' : ''} onClick={() => setTab('top')}><Trophy /> Top mineros</button></div>
    <section className="vault-list empty">{tab === 'team' ? <><Smartphone /><p>Aún no tienes reclutas. Comparte tu enlace y aparecerán aquí con su nivel y producción.</p></> : <><Trophy /><p>El ranking se mostrará cuando haya mineros verificados en Telegram.</p></>}</section>
    <p className="vault-note"><ArrowDownLeft /> Referidos y ranking pendientes de activar con el bot de Telegram.</p>
  </>;
}
