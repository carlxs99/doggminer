import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Wallet, RefreshCw, Copy, Check, ShieldCheck, LogOut, Info, Pickaxe, Gift, Users, Share2, Smartphone, LineChart, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDogg, WITHDRAW_FEE, WITHDRAW_MIN, type Entry } from './state';
import { Title } from './screens';
import { ScreenHero } from './hero';
import { JETTON, SWAP, PRICE, REF_BONUS, REF_SHARE, formatDogg, friendlyError, haptic, referralLink } from '@/lib/dogg';
import { referralAction } from '@/lib/dogg.functions';
import { coinRain, strongHaptic } from '@/lib/fx';
import { VERIFY_BUY } from '@/lib/purchase';
import { useServerFn } from '@tanstack/react-start';
import { bestLevel, getMiner } from '@/lib/mining';
import coin from '@/assets/dogg-coin.webp';
import mascot from '@/assets/dogg-mascot.webp';

const Coin = ({ size = 16 }: { size?: number }) => <img src={coin} width={size} height={size} alt="" className="inline-coin" />;
const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;
const levelFor = bestLevel;
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
    }).catch(e => { if (active) setError('No se pudieron leer tus saldos ahora mismo. Toca actualizar en unos segundos.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [wallet, refresh]);
  return { balances, error, loading };
}


/** One-time withdrawal verification: buy 100 $DOGG with the linked wallet; once passed, withdrawals are always allowed. */
function WithdrawVerify() {
  const { player, demo, verifyBuy, verifying } = useDogg();
  if (player.withdrawVerified) return <p className="wv-ok"><ShieldCheck /> Wallet verificada para retiros</p>;
  const linked = demo || Boolean(player.walletAddress);
  return <section className="withdraw-verify">
    <div className="wv-head"><span className="row-icon gold"><ShieldCheck /></span><div><strong>Verifica tu wallet para retirar</strong><small>Compra al menos <b>{VERIFY_BUY} $DOGG</b> en DeDust con tu wallet vinculada. Solo se hace una vez: después podrás retirar siempre.</small></div></div>
    <ol className="wv-steps"><li className={linked ? 'ok' : ''}><Check /> Conecta y vincula tu wallet</li><li><Check /> Compra {VERIFY_BUY} $DOGG o más con ella</li><li><Check /> Toca «Verificar compra»</li></ol>
    <div className="wv-actions"><Button asChild variant="outline"><a href={SWAP} target="_blank" rel="noopener noreferrer"><RefreshCw /> Comprar en DeDust</a></Button><Button onClick={() => void verifyBuy()} disabled={verifying || !linked}>{verifying ? <RefreshCw className="animate-spin" /> : <ShieldCheck />} Verificar compra</Button></div>
    {!linked && <small className="wv-note">Primero conecta tu wallet arriba y firma la vinculación.</small>}
  </section>;
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
      <div className="vault-split"><div><span><Pickaxe /> En la app</span><strong>{formatDogg(player.balance)}</strong></div><div><span><Wallet /> On-chain {wallet && <button aria-label="Actualizar saldo on-chain" onClick={() => setRefresh(r => r + 1)}><RefreshCw className={loading ? 'animate-spin' : ''} /></button>}</span>{loading && !balances ? <strong className="skeleton">000.000,000</strong> : <strong>{wallet ? formatDogg(onchain) : '—'}</strong>}</div></div>
    </section>

    <h2 className="vault-h">Billetera TON</h2>
    <section className="vault-row">
      <span className="vault-icon"><Wallet /></span>
      <div><strong>{wallet ? 'Conectada' : 'Sin conectar'}</strong>{wallet ? <button className="vault-addr" onClick={() => void navigator.clipboard.writeText(wallet).then(() => toast.success('Dirección copiada')).catch(() => toast.error('No se pudo copiar'))}>{short(wallet)} <Copy /></button> : <small>Conecta para ver tu stash on-chain</small>}</div>
      <Button size="icon" variant={wallet ? 'outline' : 'default'} aria-label={wallet ? 'Desconectar wallet' : 'Conectar wallet'} onClick={() => openWallet?.()} disabled={!openWallet}>{wallet ? <LogOut /> : <ArrowUpRight />}</Button>
    </section>
    {balances && <p className="vault-note">TON: {balances.ton.toLocaleString('de-DE', { maximumFractionDigits: 4 })}</p>}
    {error && <p role="alert" className="text-destructive text-sm mt-2">{error}</p>}
    <section className="vault-verify">
      <div className="vault-verify-head"><span className="vault-icon"><ShieldCheck /></span><div><strong>{player.walletAddress ? 'Billetera vinculada' : 'Billetera sin vincular'}</strong><small>Tu hold real ({formatDogg(player.hold ?? 0)} $DOGG) + lo minado en la app desbloquean mineros. Se comprueba al activar y al cobrar.</small></div></div>
      <ul><li className={wallet ? 'ok' : ''}><Check /> Billetera conectada</li><li className={player.walletAddress ? 'ok' : ''}><Check /> Vinculada a tu cuenta {player.walletAddress ? '' : <em>{demo ? 'solo en Telegram' : 'conecta para vincular'}</em>}</li></ul>
    </section>

    <h2 className="vault-h">Comprar <Coin size={20} /></h2>
    <div className="vault-buy"><a href={SWAP} target="_blank" rel="noopener noreferrer" className="buy-swap"><RefreshCw /><strong>DeDust</strong><small>Cambiar TON → $DOGG</small></a><a href={PRICE} target="_blank" rel="noopener noreferrer" className="buy-chart"><LineChart /><strong>Gráfico en vivo</strong><small>Precio de $DOGG</small></a></div>
    <p className="vault-info"><Info /> Los $DOGG que compras se quedan en tu billetera y cuentan para tu nivel. Ahora estás en el nivel {level}. Vender hace que bajes de nivel.</p>

    <h2 className="vault-h">Retirar</h2>
    <WithdrawVerify />
    <section className="vault-withdraw"><div><strong>Envía tus <Coin /> de la app a tu billetera</strong><small>Mín. {WITHDRAW_MIN.toLocaleString('de-DE')} · comisión {WITHDRAW_FEE} <Coin size={12} /></small></div>
      <form onSubmit={e => { e.preventDefault(); void withdraw(Number(amount)).then(() => setAmount('')); }}><Input inputMode="decimal" type="number" min={WITHDRAW_MIN} placeholder={`${WITHDRAW_MIN}`} value={amount} onChange={e => setAmount(e.target.value)} aria-label="Cantidad a retirar" /><Button type="submit" disabled={busy || !player.withdrawVerified}><ArrowUpRight /> Retirar</Button></form></section>

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

function useReferral() {
  const [id, setId] = useState<number | null>(null);
  useEffect(() => { setId(window.Telegram?.WebApp?.initDataUnsafe?.user?.id ?? null); }, []);
  return id ? referralLink(id) : null;
}
type RefData = { total: number; qualified: number; pending: number; earned: number; walletLinked: boolean; friends: { name: string; username: string | null; joinedAt: string; qualified: boolean; given: number }[] };

export function Amigos() {
  const { demo, busy, applyBalance } = useDogg();
  const link = useReferral();
  const refCall = useServerFn(referralAction);
  const [copied, setCopied] = useState(false);
  const [data, setData] = useState<RefData | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [now] = useState(() => Date.now());
  useEffect(() => {
    const initData = window.Telegram?.WebApp?.initData;
    if (demo || !initData) return;
    let active = true;
    refCall({ data: { initData, action: 'read' } }).then(r => { if (active) setData(r); }).catch(e => { if (active) toast.error(friendlyError(e, 'No se pudieron cargar tus referidos')); });
    return () => { active = false; };
  }, [demo, refCall]);
  async function copy() { haptic(); if (!link) { toast.info('Abre la app desde Telegram para tener tu enlace.'); return; } try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); toast.success('Invitación copiada'); } catch { toast.error('No se pudo copiar la invitación'); } }
  function share() { haptic(); if (!link) { toast.info('Abre la app desde Telegram para tener tu enlace.'); return; } const url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('🐶👑 Únete a mi crew en $DOGG MINER: mina $DOGG gratis cada día en Telegram 🌿')}`; const tg = window.Telegram?.WebApp; if (tg?.openTelegramLink) tg.openTelegramLink(url); else window.open(url, '_blank', 'noopener'); }
  async function claim() {
    haptic();
    const initData = window.Telegram?.WebApp?.initData;
    if (demo || !initData) { toast.info('Abre la app desde Telegram para reclamar tus recompensas.'); return; }
    setClaiming(true);
    try {
      const r = await refCall({ data: { initData, action: 'claim' } });
      setData(r); applyBalance(r.balance, { kind: 'team', label: 'Recompensa de referidos', amount: r.claimed });
      coinRain(coin); strongHaptic(); toast.success(`+${formatDogg(r.claimed)} $DOGG de tu crew`);
    } catch (e) { toast.error(friendlyError(e, 'No se pudo reclamar')); }
    finally { setClaiming(false); }
  }
  const d = data ?? { total: 0, qualified: 0, pending: 0, earned: 0, walletLinked: false, friends: [] };
  return <>
    <ScreenHero title="Amigos" art="cap" subtitle="Invita a tus homies y crece juntos" />
    <div className="row-list">
      <section className="info-row"><span className="row-icon"><Link2 /></span><div><strong>Tu enlace de invitación</strong><small className="break">{link ?? 'Disponible al abrir desde Telegram'}</small></div><Button size="sm" onClick={() => void copy()} aria-label="Copiar enlace">{copied ? <Check /> : <Copy />}</Button></section>
      <Button className="ref-share" onClick={share}><Share2 /> Invitar amigos</Button>
      <section className="ref-stats" aria-label="Tus referidos">
        <div><Users /><strong>{d.total}</strong><small>Invitados</small></div>
        <div><ShieldCheck /><strong>{d.qualified}</strong><small>Minando</small></div>
        <div><Coin size={18} /><strong>{formatDogg(d.earned).replace(/,000$/, '')}</strong><small>Ganado</small></div>
      </section>
      <section className="info-row ref-pending"><span className="row-icon gold"><Gift /></span><div><strong>Por reclamar</strong><b className="row-amount">{formatDogg(d.pending)} <Coin /></b><small>+{REF_BONUS} cuando tu homie inicia su primer turno · {REF_SHARE * 100} % de por vida de lo que mine</small></div><Button size="sm" onClick={() => void claim()} disabled={claiming || busy || d.pending <= 0}>{claiming ? <RefreshCw className="animate-spin" /> : 'Reclamar'}</Button></section>
    </div>
    <h2 className="vault-h center">Cómo funciona</h2>
    <ol className="ref-steps">
      <li><span>1</span><div><strong>Comparte tu enlace</strong><small>Tu homie abre $DOGG MINER desde él.</small></div></li>
      <li><span>2</span><div><strong>Inicia la minería</strong><small>Ganas <b>+{REF_BONUS} $DOGG</b> solo cuando tu homie prende su primer turno de minería. No necesita wallet.</small></div></li>
      <li><span>3</span><div><strong>Gana de por vida</strong><small>Recibes el <b>{REF_SHARE * 100} %</b> de cada turno que cobre, para siempre y sin caducidad. Él no pierde nada.</small></div></li>
    </ol>
    <h2 className="vault-h center">Últimos amigos invitados</h2>
    {d.friends.length === 0
      ? <section className="vault-list empty"><Smartphone /><p>Aún no tienes reclutas. Comparte tu enlace: cada homie cuenta cuando inicia su primer turno de minería.</p></section>
      : <section className="vault-list">{d.friends.map((f, i) => <div key={f.joinedAt + i} className="vault-item"><span className="credential-avatar ref-avatar">{f.name.slice(0, 1).toUpperCase()}</span><div><strong>{f.name}</strong><small>{f.username ? `@${f.username} · ` : ''}{ago(Date.parse(f.joinedAt), now)}</small></div><div className="vault-amount">{f.qualified ? <strong>+{formatDogg(f.given + REF_BONUS)} <Coin size={12} /></strong> : null}<em className={f.qualified ? 'ok' : ''}>{f.qualified ? 'Minando' : 'Sin minar aún'}</em></div></div>)}</section>}
  </>;
}

export function Perfil() {
  const { name, player, demo, wallet, openWallet, history, withdraw, busy } = useDogg();
  const [refresh, setRefresh] = useState(0);
  const [amount, setAmount] = useState('');
  const { balances, error, loading } = useOnchain(wallet, refresh);
  const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp?.initDataUnsafe?.user : undefined;
  const withdrawals = history.filter(e => e.kind === 'withdraw');
  const now = Date.now();
  return <>
    <ScreenHero title="Perfil" crowned art="bust" />
    <section className="info-row profile-card"><span className="credential-avatar">{name.slice(0, 1).toUpperCase()}</span><div><strong>{name}</strong>{tg?.username && <small>@{tg.username}</small>}<small>{tg?.id ? `ID ${tg.id}` : demo ? 'Modo demo' : ''}</small></div><img src={mascot} alt="" width={56} height={56} /></section>
    <Button className="wallet-pill" onClick={() => openWallet?.()} disabled={!openWallet}><Wallet />{wallet ? `Wallet conectada · ${short(wallet)}` : 'Conectar wallet'}</Button>
    <div className="row-list">
      <section className="info-row"><div><strong>Billetera de hold</strong><small>$DOGG on-chain {wallet && <button className="inline-refresh" aria-label="Actualizar saldo" onClick={() => setRefresh(r => r + 1)}><RefreshCw className={loading ? 'animate-spin' : ''} /></button>}</small></div><b className="row-amount">{wallet ? (loading && !balances ? '…' : formatDogg(balances?.dogg ?? 0)) : '—'} <Coin /></b></section>
      <section className="info-row"><div><strong>Billetera de minería</strong><small>{player.walletAddress ? 'Vinculada a tu cuenta' : 'Lista para retirar'}</small></div><b className="row-amount">{formatDogg(player.balance)} <Coin /></b></section>
    </div>
    {error && <p role="alert" className="text-destructive text-sm mt-2">{error}</p>}
    <WithdrawVerify />
    <section className="vault-withdraw stacked"><strong>Retirar $DOGG</strong>
      <form onSubmit={e => { e.preventDefault(); void withdraw(Number(amount)).then(() => setAmount('')); }}><Input inputMode="decimal" type="number" min={WITHDRAW_MIN} placeholder={`Mínimo ${WITHDRAW_MIN}`} value={amount} onChange={e => setAmount(e.target.value)} aria-label="Cantidad a retirar" /><small>Mínimo {WITHDRAW_MIN.toLocaleString('de-DE')} $DOGG. Comisión {WITHDRAW_FEE} $DOGG.</small><Button type="submit" disabled={busy || !player.withdrawVerified}><ArrowUpRight /> Solicitar retiro</Button></form></section>
    <section className="vault-list"><h3 className="list-title">Historial de retiros</h3>{withdrawals.length === 0 ? <p className="vault-empty">Aún no hay retiros.</p> : withdrawals.map(e => <div key={e.at + e.label} className="vault-item"><span className="vault-icon withdraw"><ArrowUpRight /></span><div><strong>{e.label}</strong><small>{ago(e.at, now)}</small></div><div className="vault-amount"><strong className="neg">{formatDogg(e.amount)} <Coin size={14} /></strong>{e.status === 'review' && <em>En revisión</em>}</div></div>)}</section>
    <div className="vault-buy"><a href={SWAP} target="_blank" rel="noopener noreferrer" className="buy-swap"><RefreshCw /><strong>DeDust</strong><small>Cambiar TON → $DOGG</small></a><a href={PRICE} target="_blank" rel="noopener noreferrer" className="buy-chart"><LineChart /><strong>Gráfico en vivo</strong><small>Precio de $DOGG</small></a></div>
    <div className="token-contract"><span className="eyebrow">CONTRATO DEL JETTON</span><code>{JETTON}</code></div>
  </>;
}
