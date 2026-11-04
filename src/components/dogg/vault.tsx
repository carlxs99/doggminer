import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Wallet, RefreshCw, Copy, Check, ShieldCheck, LogOut, Info, Pickaxe, Gift, Users, Share2, Smartphone, LineChart, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDogg, WITHDRAW_FEE, WITHDRAW_MIN, type Entry } from './state';
import { Title } from './screens';
import { ScreenHero } from './hero';
import { JETTON, PRICE, REF_BONUS, REF_SHARE, formatDogg, friendlyError, haptic, referralLink } from '@/lib/dogg';
import { referralAction } from '@/lib/dogg.functions';
import { coinRain, strongHaptic } from '@/lib/fx';
import { VERIFY_BUY } from '@/lib/purchase';
import { BuyDedustLink, DedustWebLink } from './buy';
import { useServerFn } from '@tanstack/react-start';
import { useT } from './lang';
import { t as tg, tLabel } from '@/lib/i18n';
import { bestLevel, getMiner } from '@/lib/mining';
import coin from '@/assets/dogg-coin.webp';

const Coin = ({ size = 16 }: { size?: number }) => <img src={coin} width={size} height={size} alt="" className="inline-coin" />;
const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;
const levelFor = bestLevel;
function ago(at: number, now: number) { const m = Math.max(0, Math.floor((now - at) / 60000)); return m < 1 ? tg('time.now') : m < 60 ? tg('time.min', { n: m }) : m < 1440 ? tg('time.h', { n: Math.floor(m / 60) }) : tg('time.d', { n: Math.floor(m / 1440) }); }

function useOnchain(wallet: string | null, refresh: number) {
  const [balances, setBalances] = useState<{ ton: number; dogg: number } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!wallet) { setBalances(null); return; }
    let active = true; setLoading(true); setError('');
    Promise.all([fetch(`https://tonapi.io/v2/accounts/${encodeURIComponent(wallet)}`), fetch(`https://tonapi.io/v2/accounts/${encodeURIComponent(wallet)}/jettons`)]).then(async rs => {
      for (const r of rs) if (!r.ok) throw new Error('balances');
      const [account, jettons] = await Promise.all(rs.map(r => r.json()));
      // Raw form of JETTON, precomputed — avoids pulling @ton/core (needs Buffer) into the browser.
      const target = '0:a74ffea7ade24751ac5b670ee0eb88243f9bf1e8bbd25d615ba16e6d62c0a92d';
      const j = jettons.balances?.find((b: { jetton: { address: string } }) => b.jetton.address === target);
      if (active) setBalances({ ton: Number(account.balance) / 1e9, dogg: j ? Number(j.balance) / 10 ** Number(j.jetton.decimals) : 0 });
    }).catch(e => { if (active) setError('vault.readFail'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [wallet, refresh]);
  return { balances, error, loading };
}


/** One-time withdrawal verification: the linked wallet must hold 100 $DOGG; once passed, withdrawals are always allowed. */
function WithdrawVerify() {
  const { player, demo, verifyBuy, verifying } = useDogg();
  const t = useT();
  if (player.withdrawVerified) return <p className="wv-ok"><ShieldCheck /> {t('wv.ok')}</p>;
  const linked = Boolean(player.walletAddress);
  return <section className="withdraw-verify">
    <div className="wv-head"><span className="row-icon gold"><ShieldCheck /></span><div><strong>{t('wv.title')}</strong><small>{t('wv.desc', { n: VERIFY_BUY })}</small></div></div>
    <ol className="wv-steps"><li className={linked ? 'ok' : ''}><Check /> {t('wv.s1')}</li><li><Check /> {t('wv.s2', { n: VERIFY_BUY })}</li><li><Check /> {t('wv.s3')}</li></ol>
    <div className="wv-actions"><Button asChild variant="outline"><BuyDedustLink><RefreshCw /> {t('wv.buy')}</BuyDedustLink></Button><Button onClick={() => void verifyBuy()} disabled={verifying || !linked}>{verifying ? <RefreshCw className="animate-spin" /> : <ShieldCheck />} {t('wv.verify')}</Button></div>
    <DedustWebLink />
    {!linked && <small className="wv-note">{t('wv.note')}</small>}
  </section>;
}

export function Billetera() {
  const { wallet, openWallet, player, history, withdraw, now, busy, demo } = useDogg();
  const t = useT();
  const [refresh, setRefresh] = useState(0);
  const [amount, setAmount] = useState('');
  const { balances, error, loading } = useOnchain(wallet, refresh);
  const onchain = balances?.dogg ?? 0;
  const total = player.balance + onchain;
  const level = levelFor(total);
  const week = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(now || 0); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (6 - i)); return { start: d.getTime(), mining: 0, team: 0, bonus: 0 }; });
    for (const e of history) { if (e.amount <= 0 || e.kind === 'withdraw') continue; const d = [...days].reverse().find(x => e.at >= x.start); if (!d) continue; if (e.kind === 'mining') d.mining += e.amount; else if (e.kind === 'team') d.team += e.amount; else d.bonus += e.amount; }
    return days;
  }, [history, now]);
  const sum = (k: 'mining' | 'team' | 'bonus') => week.reduce((a, d) => a + d[k], 0);
  const weekTotal = sum('mining') + sum('team') + sum('bonus');
  const max = Math.max(1, ...week.map(d => d.mining + d.team + d.bonus));
  const todayGain = week[6] ? week[6].mining + week[6].team + week[6].bonus : 0;
  const dayName = (at: number, i: number) => i === 6 ? t('vault.today') : new Date(at).toLocaleDateString(t.locale, { weekday: 'short' }).replace('.', '');
  return <><Title label={t('vault.label')} title="Your keys." accent="Your stash" description={t('vault.desc')} />
    <section className="vault-card">
      <img src={coin} alt="" className="vault-watermark" />
      <span className="eyebrow">{t('vault.total')}</span>
      <div className="vault-total"><Coin size={34} />{formatDogg(total)}</div>
      <span className="vault-level"><Coin size={14} /> {t('vault.level', { n: level, name: getMiner(level === 1 ? 'rookie-1' : `miner-${level}`).name })}</span>
      <div className="vault-split"><div><span><Pickaxe /> {t('vault.inApp')}</span><strong>{formatDogg(player.balance)}</strong></div><div><span><Wallet /> On-chain {wallet && <button aria-label={t('vault.refresh')} onClick={() => setRefresh(r => r + 1)}><RefreshCw className={loading ? 'animate-spin' : ''} /></button>}</span>{loading && !balances ? <strong className="skeleton">000.000,000</strong> : <strong>{wallet ? formatDogg(onchain) : '—'}</strong>}</div></div>
    </section>

    <h2 className="vault-h">{t('vault.tonWallet')}</h2>
    <section className="vault-row">
      <span className="vault-icon"><Wallet /></span>
      <div><strong>{wallet ? t('vault.connected') : t('vault.notConnected')}</strong>{wallet ? <button className="vault-addr" onClick={() => void navigator.clipboard.writeText(wallet).then(() => toast.success(t('vault.addrCopied'))).catch(() => toast.error(t('shell.copyFail')))}>{short(wallet)} <Copy /></button> : <small>{t('vault.connectHint')}</small>}</div>
      <Button size="icon" variant={wallet ? 'outline' : 'default'} aria-label={wallet ? t('vault.disconnect') : t('shell.connect')} onClick={() => openWallet?.()} disabled={!openWallet}>{wallet ? <LogOut /> : <ArrowUpRight />}</Button>
    </section>
    {balances && <p className="vault-note">TON: {balances.ton.toLocaleString('de-DE', { maximumFractionDigits: 4 })}</p>}
    {error && <p role="alert" className="text-destructive text-sm mt-2">{t('vault.readFail')}</p>}
    <section className="vault-verify">
      <div className="vault-verify-head"><span className="vault-icon"><ShieldCheck /></span><div><strong>{player.walletAddress ? t('vault.linked') : t('vault.unlinked')}</strong><small>{t('vault.holdNote', { n: formatDogg(player.hold ?? 0) })}</small></div></div>
      <ul><li className={wallet ? 'ok' : ''}><Check /> {t('vault.chkConnected')}</li><li className={player.walletAddress ? 'ok' : ''}><Check /> {t('vault.chkLinked')} {player.walletAddress ? '' : <em>{demo ? t('vault.onlyTelegram') : t('vault.connectToLink')}</em>}</li></ul>
    </section>

    <h2 className="vault-h">{t('vault.buy')} <Coin size={20} /></h2>
    <div className="vault-buy"><BuyDedustLink className="buy-swap"><RefreshCw /><strong>DeDust</strong><small>{t('vault.buyTg')}</small></BuyDedustLink><a href={PRICE} target="_blank" rel="noopener noreferrer" className="buy-chart"><LineChart /><strong>{t('vault.chart')}</strong><small>{t('vault.chartSub')}</small></a></div><DedustWebLink />
    <p className="vault-info"><Info /> {t('vault.info', { n: level })}</p>

    <h2 className="vault-h">{t('vault.withdraw')}</h2>
    <WithdrawVerify />
    <section className="vault-withdraw"><div><strong>{t('vault.sendTitle')}</strong><small>{t('vault.minFee', { min: WITHDRAW_MIN.toLocaleString('de-DE'), fee: WITHDRAW_FEE })} <Coin size={12} /></small></div>
      <form onSubmit={e => { e.preventDefault(); void withdraw(Number(amount)).then(() => setAmount('')); }}><Input inputMode="decimal" type="number" min={WITHDRAW_MIN} placeholder={`${WITHDRAW_MIN}`} value={amount} onChange={e => setAmount(e.target.value)} aria-label={t('vault.amount')} /><Button type="submit" disabled={busy || !player.withdrawVerified}><ArrowUpRight /> {t('vault.withdrawBtn')}</Button></form></section>

    <h2 className="vault-h">{t('vault.payroll')}</h2>
    <section className="vault-payroll"><div className="payroll-top"><div><span className="eyebrow">{t('vault.week')}</span><strong>{formatDogg(weekTotal)} <Coin size={18} /></strong></div><span className="payroll-today"><small>{t('vault.today')}</small>+{Math.round(todayGain)}</span></div>
      <div className="payroll-chart">{week.map((d, i) => <div key={d.start} className={i === 6 ? 'today' : ''}><div className="bar">{(['bonus', 'team', 'mining'] as const).map(k => <span key={k} className={k} style={{ height: `${d[k] / max * 100}%` }} />)}</div><small>{dayName(d.start, i)}</small></div>)}</div>
      <div className="payroll-legend"><div><i className="mining" /> {t('vault.legMining')}<strong>{Math.round(sum('mining'))}</strong></div><div><i className="team" /> {t('vault.legTeam')}<strong>{Math.round(sum('team'))}</strong></div><div><i className="bonus" /> {t('vault.legBonus')}<strong>{Math.round(sum('bonus'))}</strong></div></div></section>

    <h2 className="vault-h"><ShieldCheck /> {t('vault.board')}</h2>
    <section className="vault-list empty"><ArrowUpRight /><p>{t('vault.boardEmpty')}</p></section>

    <h2 className="vault-h">{t('vault.history')}</h2>
    <section className="vault-list">{history.length === 0 ? <p className="vault-empty">{t('vault.historyEmpty')}</p> : history.map((e: Entry) => <div key={e.at + e.label} className="vault-item"><span className={`vault-icon ${e.kind}`}>{e.kind === 'mining' ? <Pickaxe /> : e.kind === 'withdraw' ? <ArrowUpRight /> : e.kind === 'team' ? <Users /> : <Gift />}</span><div><strong>{e.kind === 'task' ? t('vault.taskPrize') : tLabel(e.label, t.lang)}</strong><small>{e.kind === 'task' ? `${tLabel(e.label, t.lang)} · ` : ''}{ago(e.at, now)}</small></div><div className="vault-amount"><strong className={e.amount < 0 ? 'neg' : ''}>{e.amount > 0 ? '+' : ''}{formatDogg(e.amount)} <Coin size={14} /></strong>{e.status === 'review' && <em>{t('vault.review')}</em>}</div></div>)}</section>

    <div className="token-contract"><span className="eyebrow">{t('vault.contract')}</span><code>{JETTON}</code><span><ShieldCheck /> {t('vault.unverified')}</span></div>
  </>;
}

function useReferral() {
  const [id, setId] = useState<number | null>(null);
  useEffect(() => { setId(window.Telegram?.WebApp?.initDataUnsafe?.user?.id ?? null); }, []);
  return id ? referralLink(id) : null;
}
type RefData = { total: number; qualified: number; pending: number; earned: number; walletLinked: boolean; friends: { name: string; username: string | null; joinedAt: string; qualified: boolean; given: number }[] };

let refCache: RefData | null = null;
export function Amigos() {
  const { demo, busy, applyBalance } = useDogg();
  const t = useT();
  const link = useReferral();
  const refCall = useServerFn(referralAction);
  const [copied, setCopied] = useState(false);
  const [data, setDataState] = useState<RefData | null>(refCache);
  const setData = (d: RefData) => { refCache = d; setDataState(d); };
  const [claiming, setClaiming] = useState(false);
  const [now] = useState(() => Date.now());
  useEffect(() => {
    const initData = window.Telegram?.WebApp?.initData;
    if (demo || !initData) return;
    let active = true;
    refCall({ data: { initData, action: 'read' } }).then(r => { if (active) setData(r); }).catch(e => { if (active) toast.error(friendlyError(e, t('friends.loadFail'))); });
    return () => { active = false; };
  }, [demo, refCall]);
  async function copy() { haptic(); if (!link) { toast.info(t('friends.openTg')); return; } try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); toast.success(t('friends.copied')); } catch { toast.error(t('friends.copyFail')); } }
  function share() { haptic(); if (!link) { toast.info(t('friends.openTg')); return; } const url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(t('friends.shareText'))}`; const tg = window.Telegram?.WebApp; if (tg?.openTelegramLink) tg.openTelegramLink(url); else window.open(url, '_blank', 'noopener'); }
  async function claim() {
    haptic();
    const initData = window.Telegram?.WebApp?.initData;
    if (demo || !initData) { toast.info(t('friends.claimTg')); return; }
    setClaiming(true);
    try {
      const r = await refCall({ data: { initData, action: 'claim' } });
      setData(r); applyBalance(r.balance, { kind: 'team', label: 'hist.ref', amount: r.claimed });
      coinRain(coin); strongHaptic(); toast.success(t('friends.claimed', { n: formatDogg(r.claimed) }));
    } catch (e) { toast.error(friendlyError(e, t('friends.claimFail'))); }
    finally { setClaiming(false); }
  }
  const d = data ?? { total: 0, qualified: 0, pending: 0, earned: 0, walletLinked: false, friends: [] };
  return <>
    <ScreenHero title={t('nav.friends')} art="cap" subtitle={t('friends.subtitle')} />
    <div className="row-list">
      <section className="info-row"><span className="row-icon"><Link2 /></span><div><strong>{t('friends.link')}</strong><small className="break">{link ?? t('friends.linkTg')}</small></div><Button size="sm" onClick={() => void copy()} aria-label={t('friends.copyLink')}>{copied ? <Check /> : <Copy />}</Button></section>
      <Button className="ref-share" onClick={share}><Share2 /> {t('friends.invite')}</Button>
      <section className="ref-stats" aria-label={t('friends.stats')}>
        <div><Users /><strong>{d.total}</strong><small>{t('friends.invited')}</small></div>
        <div><ShieldCheck /><strong>{d.qualified}</strong><small>{t('friends.mining')}</small></div>
        <div><Coin size={18} /><strong>{formatDogg(d.earned).replace(/,000$/, '')}</strong><small>{t('friends.earned')}</small></div>
      </section>
      <section className="info-row ref-pending"><span className="row-icon gold"><Gift /></span><div><strong>{t('friends.pending')}</strong><b className="row-amount">{formatDogg(d.pending)} <Coin /></b><small>{t('friends.pendingSub', { b: REF_BONUS, p: REF_SHARE * 100 })}</small></div><Button size="sm" onClick={() => void claim()} disabled={claiming || busy || d.pending <= 0}>{claiming ? <RefreshCw className="animate-spin" /> : t('friends.claim')}</Button></section>
    </div>
    <h2 className="vault-h center">{t('friends.how')}</h2>
    <ol className="ref-steps">
      <li><span>1</span><div><strong>{t('friends.h1')}</strong><small>{t('friends.h1d')}</small></div></li>
      <li><span>2</span><div><strong>{t('friends.h2')}</strong><small>{t('friends.h2d', { b: REF_BONUS })}</small></div></li>
      <li><span>3</span><div><strong>{t('friends.h3')}</strong><small>{t('friends.h3d', { p: REF_SHARE * 100 })}</small></div></li>
    </ol>
    <h2 className="vault-h center">{t('friends.latest')}</h2>
    {d.friends.length === 0
      ? <section className="vault-list empty"><Smartphone /><p>{t('friends.empty')}</p></section>
      : <section className="vault-list">{d.friends.map((f, i) => <div key={f.joinedAt + i} className="vault-item"><span className="credential-avatar ref-avatar">{f.name.slice(0, 1).toUpperCase()}</span><div><strong>{f.name}</strong><small>{f.username ? `@${f.username} · ` : ''}{ago(Date.parse(f.joinedAt), now)}</small></div><div className="vault-amount">{f.qualified ? <strong>+{formatDogg(f.given + REF_BONUS)} <Coin size={12} /></strong> : null}<em className={f.qualified ? 'ok' : ''}>{f.qualified ? t('friends.mining') : t('friends.notMining')}</em></div></div>)}</section>}
  </>;
}

export function Perfil() {
  const { name, player, demo, wallet, openWallet, history, withdraw, busy } = useDogg();
  const t = useT();
  const [refresh, setRefresh] = useState(0);
  const [amount, setAmount] = useState('');
  const { balances, error, loading } = useOnchain(wallet, refresh);
  const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp?.initDataUnsafe?.user : undefined;
  const withdrawals = history.filter(e => e.kind === 'withdraw' && e.amount < 0);
  const now = Date.now();
  return <>
    <ScreenHero title={t('profile.title')} crowned art="bust" />
    <section className="info-row profile-card"><span className="credential-avatar">{name.slice(0, 1).toUpperCase()}</span><div><strong>{name}</strong>{tg?.username && <small>@{tg.username}</small>}<small>{tg?.id ? `ID ${tg.id}` : ''}</small></div><img className="profile-dogg" src={coin} alt="$DOGG" width={56} height={56} /></section>
    <Button className="wallet-pill" onClick={() => openWallet?.()} disabled={!openWallet}><Wallet />{wallet ? t('profile.walletOn', { a: short(wallet) }) : t('shell.connect')}</Button>
    <div className="row-list">
      <section className="info-row"><div><strong>{t('profile.holdWallet')}</strong><small>$DOGG on-chain {wallet && <button className="inline-refresh" aria-label={t('profile.refresh')} onClick={() => setRefresh(r => r + 1)}><RefreshCw className={loading ? 'animate-spin' : ''} /></button>}</small></div><b className="row-amount">{wallet ? (loading && !balances ? '…' : formatDogg(balances?.dogg ?? 0)) : '—'} <Coin /></b></section>
      <section className="info-row"><div><strong>{t('profile.miningWallet')}</strong><small>{player.walletAddress ? t('profile.linked') : t('profile.ready')}</small></div><b className="row-amount">{formatDogg(player.balance)} <Coin /></b></section>
    </div>
    {error && <p role="alert" className="text-destructive text-sm mt-2">{t('vault.readFail')}</p>}
    <WithdrawVerify />
    <section className="vault-withdraw stacked"><strong>{t('profile.withdraw')}</strong>
      <form onSubmit={e => { e.preventDefault(); void withdraw(Number(amount)).then(() => setAmount('')); }}><Input inputMode="decimal" type="number" min={WITHDRAW_MIN} placeholder={t('profile.minPh', { n: WITHDRAW_MIN })} value={amount} onChange={e => setAmount(e.target.value)} aria-label={t('vault.amount')} /><small>{t('profile.minNote', { min: WITHDRAW_MIN.toLocaleString('de-DE'), fee: WITHDRAW_FEE })}</small><Button type="submit" disabled={busy || !player.withdrawVerified}><ArrowUpRight /> {t('profile.request')}</Button></form></section>
    <section className="vault-list"><h3 className="list-title">{t('profile.wdHistory')}</h3>{withdrawals.length === 0 ? <p className="vault-empty">{t('profile.wdEmpty')}</p> : withdrawals.map(e => <div key={e.at + e.label} className="vault-item"><span className="vault-icon withdraw"><ArrowUpRight /></span><div><strong>{tLabel(e.label, t.lang)}</strong><small>{ago(e.at, now)}</small></div><div className="vault-amount"><strong className="neg">{formatDogg(e.amount)} <Coin size={14} /></strong>{e.status === 'review' && <em>{t('vault.review')}</em>}</div></div>)}</section>
    <div className="vault-buy"><BuyDedustLink className="buy-swap"><RefreshCw /><strong>DeDust</strong><small>{t('vault.buyTg')}</small></BuyDedustLink><a href={PRICE} target="_blank" rel="noopener noreferrer" className="buy-chart"><LineChart /><strong>{t('vault.chart')}</strong><small>{t('vault.chartSub')}</small></a></div><DedustWebLink />
    <div className="token-contract"><span className="eyebrow">{t('vault.contract')}</span><code>{JETTON}</code></div>
  </>;
}
