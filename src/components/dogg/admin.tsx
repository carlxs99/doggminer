import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Bot, Megaphone, Users, RefreshCw, Pause, Play, Trash2, Pencil, Search, ArrowUpRight, Wallet, ShieldCheck, ListChecks, LayoutDashboard, Plus, Minus, Check, Undo2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDogg } from './state';
import { adminAdjust, adminOverview, adminSaveTask, adminTaskAction, adminTasks, adminUsers, adminWithdrawalAction, adminWithdrawals, type AdminTask, type AdminUser, type AdminWithdrawal } from '@/lib/admin.functions';
import type { TaskKind } from '@/lib/tasks';
import { useT } from './lang';
import { currentLang, LOCALE, t as tg, type Key } from '@/lib/i18n';
import { friendlyError, haptic } from '@/lib/dogg';
import { getMiner } from '@/lib/mining';

const n = (v: number, d = 0) => Number(v ?? 0).toLocaleString(LOCALE[currentLang()], { maximumFractionDigits: d });
const when = (iso: string | null) => iso ? new Date(iso).toLocaleString(LOCALE[currentLang()], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
const short = (a: string) => a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
const initData = () => window.Telegram?.WebApp?.initData ?? '';
type Tab = 'resumen' | 'tareas' | 'usuarios' | 'retiros';
const TABS: { id: Tab; label: Key; icon: typeof Bot }[] = [
  { id: 'resumen', label: 'admin.tabSummary', icon: LayoutDashboard },
  { id: 'tareas', label: 'admin.tabTasks', icon: ListChecks },
  { id: 'usuarios', label: 'admin.tabUsers', icon: Users },
  { id: 'retiros', label: 'admin.tabWd', icon: ArrowUpRight },
];

export function AdminPanel() {
  const { isAdmin, demo } = useDogg();
  const t = useT();
  const [tab, setTab] = useState<Tab>('resumen');
  if (!isAdmin) return <section className="admin-locked"><ShieldCheck /><h1>{t('admin.title')}</h1><p>{demo ? t('admin.lockedDemo') : t('admin.locked')}</p></section>;
  return <div className="admin">
    <header className="admin-head"><h1><ShieldCheck /> {t('admin.title')}</h1><p>{t('admin.logged')}</p></header>
    <nav className="admin-tabs" role="tablist">{TABS.map(({ id, label, icon: Icon }) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => { haptic(); setTab(id); }}><Icon />{t(label)}</button>)}</nav>
    {tab === 'resumen' && <Overview />}
    {tab === 'tareas' && <TasksAdmin />}
    {tab === 'usuarios' && <UsersAdmin />}
    {tab === 'retiros' && <WithdrawalsAdmin />}
  </div>;
}

function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(() => { setLoading(true); fn().then(setData).catch(e => toast.error(friendlyError(e, tg('admin.loadFail')))).finally(() => setLoading(false)); }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(reload, [reload]);
  return { data, loading, reload, setData };
}

const Stat = ({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) => <div className="admin-stat"><small>{label}</small><strong>{value}</strong>{sub && <span>{sub}</span>}</div>;

function Overview() {
  const call = useServerFn(adminOverview);
  const t = useT();
  const { data, loading, reload } = useLoad(() => call({ data: { initData: initData() } }), [call]);
  const s = data?.stats ?? {};
  const w = data?.wallet ?? {};
  const lowTon = typeof w['ton'] === 'number' && w['ton'] < 0.08;
  return <>
    <div className="admin-bar"><span>{t('admin.state')}</span><Button size="sm" variant="outline" onClick={reload} disabled={loading}><RefreshCw className={loading ? 'animate-spin' : ''} /> {t('admin.refresh')}</Button></div>
    <div className="admin-stats">
      <Stat label={t('admin.users')} value={n(s['users'] ?? 0)} sub={t('admin.usersSub', { a: n(s['new24h'] ?? 0), b: n(s['new7d'] ?? 0) })} />
      <Stat label={t('admin.miningNow')} value={n(s['mining'] ?? 0)} />
      <Stat label={t('admin.wallets')} value={n(s['wallets'] ?? 0)} sub={t('admin.walletsSub', { n: n(s['verifiedWithdraw'] ?? 0) })} />
      <Stat label={t('admin.appBalance')} value={n(s['appBalance'] ?? 0)} sub={t('admin.appBalanceSub', { n: n(s['refPending'] ?? 0) })} />
      <Stat label={t('admin.referred')} value={n(s['referred'] ?? 0)} />
      <Stat label={t('admin.adsToday')} value={n(s['adsToday'] ?? 0)} />
      <Stat label={t('admin.tasksPaid')} value={n(s['tasksPaid'] ?? 0)} sub={t('admin.tasksPaidSub', { n: n(s['tasksPaid24h'] ?? 0) })} />
      <Stat label={t('admin.wd')} value={t('admin.wdVal', { a: n(s['wdPending'] ?? 0), b: n(s['wdSending'] ?? 0) })} sub={t('admin.wdSub', { n: n(s['wdSent'] ?? 0), x: n(s['wdSentAmount'] ?? 0) })} />
    </div>
    <section className={`admin-card ${lowTon ? 'warn' : ''}`}>
      <h2><Wallet /> {t('admin.payout')}</h2>
      {w['error'] ? <p className="admin-err">{String(w['error'])}</p> : <>
        <p className="admin-mono">{String(w['address'] ?? '…')} · {String(w['version'] ?? '')}</p>
        <div className="admin-row2"><Stat label="TON" value={n(Number(w['ton'] ?? 0), 4)} /><Stat label="$DOGG" value={n(Number(w['dogg'] ?? 0))} /><Stat label={t('admin.queued')} value={n(s['wdQueuedAmount'] ?? 0)} /></div>
        {lowTon && <p className="admin-err">{t('admin.lowTon')}</p>}
      </>}
    </section>
    <section className={`admin-card ${data && !data.monetagUrl ? 'warn' : ''}`}>
      <h2><Megaphone /> {t('admin.monetag')}</h2>
      {data?.monetagUrl ? <>
        <p className="admin-muted">{t('admin.monetagHelp')}</p>
        <p className="admin-mono">{data.monetagUrl.replace(/secret=[^&]+/, 'secret=••••••')}</p>
        <Button size="sm" onClick={() => { void navigator.clipboard.writeText(data.monetagUrl!).then(() => toast.success(t('admin.monetagCopied')), () => toast.error(t('admin.monetagCopyFail'))); }}><Check /> {t('admin.monetagCopy')}</Button>
      </> : <p className="admin-err">{t('admin.monetagMissing')}</p>}
    </section>
    <section className="admin-card"><h2>{t('admin.lastActions')}</h2>{data?.log.length ? <ul className="admin-log">{data.log.map((l, i) => <li key={i}><b>{l.action}</b><span>{l.details}</span><small>{when(l.at)}</small></li>)}</ul> : <p className="admin-muted">{t('admin.noActions')}</p>}</section>
  </>;
}

const EMPTY = { id: undefined as string | undefined, kind: 'channel' as TaskKind, title: '', description: '', url: '', chatId: '', reward: '100', sort: '0' };
const KIND_ICON = { channel: Megaphone, group: Users, bot: Bot } as const;

function TasksAdmin() {
  const list = useServerFn(adminTasks);
  const save = useServerFn(adminSaveTask);
  const act = useServerFn(adminTaskAction);
  const t = useT();
  const { data, loading, reload } = useLoad(() => list({ data: { initData: initData() } }), [list]);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof EMPTY, v: string) => setForm(f => ({ ...f, [k]: v }));
  async function submit(e: React.FormEvent) {
    e.preventDefault(); haptic(); setSaving(true);
    try {
      await save({ data: { initData: initData(), ...(form.id ? { id: form.id } : {}), kind: form.kind, title: form.title, description: form.description || undefined, url: form.url, chatId: form.chatId || undefined, reward: Number(form.reward), sort: Math.round(Number(form.sort) || 0), active: true } });
      toast.success(form.id ? t('admin.taskUpdated') : t('admin.taskCreated')); setForm(EMPTY); reload();
    } catch (err) { toast.error(friendlyError(err, t('admin.saveFail'))); } finally { setSaving(false); }
  }
  async function action(task: AdminTask, a: 'activate' | 'pause' | 'delete') {
    if (a === 'delete' && !window.confirm(t('admin.confirmDelete', { t: task.title }))) return;
    try { await act({ data: { initData: initData(), id: task.id, action: a } }); toast.success(a === 'delete' ? t('admin.taskDeleted') : a === 'pause' ? t('admin.taskPaused') : t('admin.taskActivated')); reload(); }
    catch (err) { toast.error(friendlyError(err)); }
  }
  const edit = (task: AdminTask) => { haptic(); setForm({ id: task.id, kind: task.kind, title: task.title, description: task.description ?? '', url: task.url, chatId: task.chat_id ?? '', reward: String(task.reward), sort: String(task.sort) }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  return <>
    <form className="admin-card admin-form" onSubmit={submit}>
      <h2>{form.id ? t('admin.editTask') : t('admin.newTask')}</h2>
      <div className="admin-kinds">{(['channel', 'group', 'bot'] as TaskKind[]).map(k => { const I = KIND_ICON[k]; return <button type="button" key={k} className={form.kind === k ? 'on' : ''} onClick={() => set('kind', k)}><I />{t(`admin.kind.${k}`)}</button>; })}</div>
      <p className="admin-muted">{form.kind === 'bot' ? t('admin.hintBot') : form.kind === 'channel' ? t('admin.hintChannel') : t('admin.hintGroup')}</p>
      <label>{t('admin.fTitle')}<Input required maxLength={80} value={form.title} onChange={e => set('title', e.target.value)} placeholder={form.kind === 'bot' ? t('admin.fTitlePhBot') : t('admin.fTitlePh')} /></label>
      <label>{t('admin.fDesc')}<Input maxLength={160} value={form.description} onChange={e => set('description', e.target.value)} placeholder={t('admin.fDescPh')} /></label>
      <label>{t('admin.fLink')}<Input required value={form.url} onChange={e => set('url', e.target.value)} placeholder={form.kind === 'bot' ? t('admin.fLinkPhBot') : t('admin.fLinkPh')} /></label>
      {form.kind !== 'bot' && <label>{t('admin.fChat')}<Input value={form.chatId} onChange={e => set('chatId', e.target.value)} placeholder="-1001234567890" /></label>}
      <div className="admin-row2"><label>{t('admin.fReward')}<Input required type="number" inputMode="decimal" min={1} max={100000} value={form.reward} onChange={e => set('reward', e.target.value)} /></label><label>{t('admin.fSort')}<Input type="number" value={form.sort} onChange={e => set('sort', e.target.value)} /></label></div>
      <div className="admin-actions"><Button type="submit" disabled={saving}>{saving ? <RefreshCw className="animate-spin" /> : <Check />} {form.id ? t('admin.save') : t('admin.create')}</Button>{form.id && <Button type="button" variant="outline" onClick={() => setForm(EMPTY)}>{t('admin.cancel')}</Button>}</div>
    </form>
    <div className="admin-bar"><span>{t('admin.tasksCount', { n: data?.length ?? 0 })}</span><Button size="sm" variant="outline" onClick={reload} disabled={loading}><RefreshCw className={loading ? 'animate-spin' : ''} /></Button></div>
    <div className="admin-list">{data?.length === 0 && <p className="admin-muted">{t('admin.noTasks')}</p>}
      {data?.map(task => { const I = KIND_ICON[task.kind]; return <article key={task.id} className={`admin-item ${task.active ? '' : 'off'}`}>
        <span className="admin-ico"><I /></span>
        <div><strong>{task.title}</strong><small>{t('admin.taskMeta', { kind: t(`admin.kind.${task.kind}`), r: n(task.reward, 3), n: n(task.claims) })}{task.active ? '' : t('admin.paused')}</small><small className="admin-mono">{task.url}</small></div>
        <div className="admin-btns"><Button size="icon" variant="ghost" aria-label={t('admin.edit')} onClick={() => edit(task)}><Pencil /></Button><Button size="icon" variant="ghost" aria-label={task.active ? t('admin.pause') : t('admin.activate')} onClick={() => void action(task, task.active ? 'pause' : 'activate')}>{task.active ? <Pause /> : <Play />}</Button><Button size="icon" variant="ghost" aria-label={t('admin.delete')} onClick={() => void action(task, 'delete')}><Trash2 /></Button></div>
      </article>; })}</div>
  </>;
}

function UsersAdmin() {
  const call = useServerFn(adminUsers);
  const adjust = useServerFn(adminAdjust);
  const t = useT();
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'recent' | 'balance'>('recent');
  const { data, loading, setData } = useLoad(() => call({ data: { initData: initData(), q: query, sort } }), [call, query, sort]);
  const [open, setOpen] = useState<number | null>(null);
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  async function apply(u: AdminUser, sign: 1 | -1) {
    const amount = Number(delta);
    if (!amount || amount <= 0) { toast.error(t('admin.needAmount')); return; }
    if (reason.trim().length < 2) { toast.error(t('admin.needReason')); return; }
    try {
      const r = await adjust({ data: { initData: initData(), telegramId: u.telegram_id, delta: sign * amount, reason } });
      setData(list => list?.map(x => x.telegram_id === u.telegram_id ? { ...x, balance: r.balance } : x) ?? null);
      setDelta(''); setReason(''); toast.success(t('admin.balanceSet', { n: n(r.balance, 3) }));
    } catch (e) { toast.error(friendlyError(e)); }
  }
  return <>
    <form className="admin-search" onSubmit={e => { e.preventDefault(); setQuery(q); }}><Input value={q} onChange={e => setQ(e.target.value)} placeholder={t('admin.search')} aria-label={t('admin.search')} /><Button type="submit" size="icon" aria-label={t('admin.searchBtn')}><Search /></Button></form>
    <div className="admin-chips"><button className={sort === 'recent' ? 'on' : ''} onClick={() => setSort('recent')}>{t('admin.recent')}</button><button className={sort === 'balance' ? 'on' : ''} onClick={() => setSort('balance')}>{t('admin.richest')}</button>{loading && <RefreshCw className="animate-spin" />}</div>
    <div className="admin-list">{data?.length === 0 && <p className="admin-muted">{t('admin.noResults')}</p>}
      {data?.map(u => <article key={u.telegram_id} className="admin-item col">
        <button className="admin-user" onClick={() => { haptic(); setOpen(open === u.telegram_id ? null : u.telegram_id); }}>
          <span className="admin-ico">{(u.first_name || u.username || '?').slice(0, 1).toUpperCase()}</span>
          <div><strong>{u.first_name || t('admin.noName')}{u.username ? ` · @${u.username}` : ''}</strong><small>ID {u.telegram_id} · {n(u.balance, 3)} $DOGG · {getMiner(u.miner_id).name}</small></div>
        </button>
        {open === u.telegram_id && <div className="admin-detail">
          <dl>
            <dt>{t('admin.joined')}</dt><dd>{when(u.created_at)}</dd>
            <dt>{t('admin.shifts')}</dt><dd>{n(u.claimed_shifts)}{u.shift_started_at ? t('admin.miningNowShort') : ''}</dd>
            <dt>{t('admin.wallet')}</dt><dd className="admin-mono">{u.wallet_address ? short(u.wallet_address) : '—'}</dd>
            <dt>{t('admin.hold')}</dt><dd>{u.last_hold == null ? '—' : n(u.last_hold)}</dd>
            <dt>{t('admin.verified')}</dt><dd>{u.withdraw_verified_at ? t('admin.yes', { d: when(u.withdraw_verified_at) }) : t('admin.no')}</dd>
            <dt>{t('admin.invitedBy')}</dt><dd>{u.referred_by ?? '—'}</dd>
            <dt>{t('admin.refs')}</dt><dd>{t('admin.refsVal', { a: n(u.ref_earned, 2), b: n(u.ref_pending, 2) })}</dd>
          </dl>
          <div className="admin-adjust"><Input type="number" inputMode="decimal" min={0} value={delta} onChange={e => setDelta(e.target.value)} placeholder={t('admin.amount')} aria-label={t('admin.amount')} /><Input value={reason} onChange={e => setReason(e.target.value)} placeholder={t('admin.reason')} aria-label={t('admin.reason')} maxLength={200} /></div>
          <div className="admin-actions"><Button size="sm" onClick={() => void apply(u, 1)}><Plus /> {t('admin.add')}</Button><Button size="sm" variant="outline" onClick={() => void apply(u, -1)}><Minus /> {t('admin.sub')}</Button></div>
        </div>}
      </article>)}</div>
  </>;
}

const WD_FILTERS = [['all', 'admin.fAll'], ['pending', 'admin.fPending'], ['sending', 'admin.fSending'], ['sent', 'admin.fSent'], ['failed', 'admin.fFailed']] as const satisfies readonly (readonly [string, Key])[];
const WD_LABEL: Record<string, Key> = { pending: 'admin.sPending', sending: 'admin.sSending', sent: 'admin.sSent', failed: 'admin.sFailed' };

function WithdrawalsAdmin() {
  const call = useServerFn(adminWithdrawals);
  const act = useServerFn(adminWithdrawalAction);
  const t = useT();
  const [status, setStatus] = useState<(typeof WD_FILTERS)[number][0]>('all');
  const { data, loading, reload } = useLoad(() => call({ data: { initData: initData(), status } }), [call, status]);
  const [running, setRunning] = useState(false);
  async function run() { haptic(); setRunning(true); try { await act({ data: { initData: initData(), action: 'run' } }); toast.success(t('admin.queueDone')); reload(); } catch (e) { toast.error(friendlyError(e)); } finally { setRunning(false); } }
  async function resolve(w: AdminWithdrawal, action: 'refund' | 'mark_sent') {
    let txHash: string | undefined;
    if (action === 'refund' && !window.confirm(t('admin.confirmRefund', { n: n(w.amount + w.fee), u: w.telegram_id }))) return;
    if (action === 'mark_sent') { const v = window.prompt(t('admin.txPrompt')); if (v === null) return; txHash = v; }
    try { await act({ data: { initData: initData(), action, id: w.id, ...(txHash ? { txHash } : {}) } }); toast.success(action === 'refund' ? t('admin.refunded') : t('admin.markedSent')); reload(); }
    catch (e) { toast.error(friendlyError(e)); }
  }
  return <>
    <div className="admin-bar"><span>{t('admin.wdAuto')}</span><Button size="sm" onClick={() => void run()} disabled={running}>{running ? <RefreshCw className="animate-spin" /> : <Send />} {t('admin.sendNow')}</Button></div>
    <div className="admin-chips">{WD_FILTERS.map(([id, label]) => <button key={id} className={status === id ? 'on' : ''} onClick={() => setStatus(id)}>{t(label)}</button>)}{loading && <RefreshCw className="animate-spin" />}</div>
    <div className="admin-list">{data?.length === 0 && <p className="admin-muted">{t('admin.noWd')}</p>}
      {data?.map(w => <article key={w.id} className="admin-item col">
        <div className="admin-wd"><strong>{n(w.amount)} $DOGG</strong><em className={`wd-${w.status}`}>{WD_LABEL[w.status] ? t(WD_LABEL[w.status]!) : w.status}</em></div>
        <small>{t('admin.wdUser', { u: w.telegram_id, d: when(w.created_at) })}{w.attempts > 1 ? t('admin.attempts', { n: w.attempts }) : ''}</small>
        <small className="admin-mono">{t('admin.to', { a: short(w.address) })}{w.tx_hash ? ` · tx ${short(w.tx_hash)}` : ''}</small>
        {w.error && <small className="admin-err">{w.error}</small>}
        {(w.status === 'pending' || w.status === 'sending') && <div className="admin-actions"><Button size="sm" variant="outline" onClick={() => void resolve(w, 'mark_sent')}><Check /> {t('admin.markSent')}</Button><Button size="sm" variant="outline" onClick={() => void resolve(w, 'refund')}><Undo2 /> {t('admin.refund')}</Button></div>}
      </article>)}</div>
  </>;
}
