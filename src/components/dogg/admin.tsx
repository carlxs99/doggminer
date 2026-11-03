import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Bot, Megaphone, Users, RefreshCw, Pause, Play, Trash2, Pencil, Search, ArrowUpRight, Wallet, ShieldCheck, ListChecks, LayoutDashboard, Plus, Minus, Check, Undo2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDogg } from './state';
import { adminAdjust, adminOverview, adminSaveTask, adminTaskAction, adminTasks, adminUsers, adminWithdrawalAction, adminWithdrawals, type AdminTask, type AdminUser, type AdminWithdrawal } from '@/lib/admin.functions';
import { TASK_KIND_LABEL, type TaskKind } from '@/lib/tasks';
import { friendlyError, haptic } from '@/lib/dogg';
import { getMiner } from '@/lib/mining';

const n = (v: number, d = 0) => Number(v ?? 0).toLocaleString('es-ES', { maximumFractionDigits: d });
const when = (iso: string | null) => iso ? new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
const short = (a: string) => a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
const initData = () => window.Telegram?.WebApp?.initData ?? '';
type Tab = 'resumen' | 'tareas' | 'usuarios' | 'retiros';
const TABS: { id: Tab; label: string; icon: typeof Bot }[] = [
  { id: 'resumen', label: 'Resumen', icon: LayoutDashboard },
  { id: 'tareas', label: 'Tareas', icon: ListChecks },
  { id: 'usuarios', label: 'Usuarios', icon: Users },
  { id: 'retiros', label: 'Retiros', icon: ArrowUpRight },
];

export function AdminPanel() {
  const { isAdmin, demo } = useDogg();
  const [tab, setTab] = useState<Tab>('resumen');
  if (!isAdmin) return <section className="admin-locked"><ShieldCheck /><h1>Panel de admin</h1><p>{demo ? 'Abre la mini app desde Telegram con la cuenta de admin para entrar.' : 'Esta sección es solo para el admin.'}</p></section>;
  return <div className="admin">
    <header className="admin-head"><h1><ShieldCheck /> Panel de admin</h1><p>Todo lo que haces aquí queda registrado.</p></header>
    <nav className="admin-tabs" role="tablist">{TABS.map(({ id, label, icon: Icon }) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => { haptic(); setTab(id); }}><Icon />{label}</button>)}</nav>
    {tab === 'resumen' && <Overview />}
    {tab === 'tareas' && <TasksAdmin />}
    {tab === 'usuarios' && <UsersAdmin />}
    {tab === 'retiros' && <WithdrawalsAdmin />}
  </div>;
}

function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(() => { setLoading(true); fn().then(setData).catch(e => toast.error(friendlyError(e, 'No se pudo cargar'))).finally(() => setLoading(false)); }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(reload, [reload]);
  return { data, loading, reload, setData };
}

const Stat = ({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) => <div className="admin-stat"><small>{label}</small><strong>{value}</strong>{sub && <span>{sub}</span>}</div>;

function Overview() {
  const call = useServerFn(adminOverview);
  const { data, loading, reload } = useLoad(() => call({ data: { initData: initData() } }), [call]);
  const s = data?.stats ?? {};
  const w = data?.wallet ?? {};
  const lowTon = typeof w['ton'] === 'number' && w['ton'] < 0.08;
  return <>
    <div className="admin-bar"><span>Estado del club</span><Button size="sm" variant="outline" onClick={reload} disabled={loading}><RefreshCw className={loading ? 'animate-spin' : ''} /> Actualizar</Button></div>
    <div className="admin-stats">
      <Stat label="Usuarios" value={n(s['users'] ?? 0)} sub={`+${n(s['new24h'] ?? 0)} hoy · +${n(s['new7d'] ?? 0)} 7 d`} />
      <Stat label="Minando ahora" value={n(s['mining'] ?? 0)} />
      <Stat label="Wallets vinculadas" value={n(s['wallets'] ?? 0)} sub={`${n(s['verifiedWithdraw'] ?? 0)} verificadas para retirar`} />
      <Stat label="$DOGG en la app" value={n(s['appBalance'] ?? 0)} sub={`${n(s['refPending'] ?? 0)} de referidos sin reclamar`} />
      <Stat label="Referidos" value={n(s['referred'] ?? 0)} />
      <Stat label="Anuncios hoy" value={n(s['adsToday'] ?? 0)} />
      <Stat label="Tareas cobradas" value={n(s['tasksPaid'] ?? 0)} sub={`${n(s['tasksPaid24h'] ?? 0)} $DOGG en 24 h`} />
      <Stat label="Retiros" value={`${n(s['wdPending'] ?? 0)} en cola · ${n(s['wdSending'] ?? 0)} enviando`} sub={`${n(s['wdSent'] ?? 0)} enviados (${n(s['wdSentAmount'] ?? 0)} $DOGG)`} />
    </div>
    <section className={`admin-card ${lowTon ? 'warn' : ''}`}>
      <h2><Wallet /> Wallet de pagos</h2>
      {w['error'] ? <p className="admin-err">{String(w['error'])}</p> : <>
        <p className="admin-mono">{String(w['address'] ?? '…')} · {String(w['version'] ?? '')}</p>
        <div className="admin-row2"><Stat label="TON" value={n(Number(w['ton'] ?? 0), 4)} /><Stat label="$DOGG" value={n(Number(w['dogg'] ?? 0))} /><Stat label="En cola" value={n(s['wdQueuedAmount'] ?? 0)} /></div>
        {lowTon && <p className="admin-err">Poco TON: cada retiro necesita ~0,06 TON. Recarga la wallet para que los retiros salgan solos.</p>}
      </>}
    </section>
    <section className="admin-card"><h2>Últimas acciones de admin</h2>{data?.log.length ? <ul className="admin-log">{data.log.map((l, i) => <li key={i}><b>{l.action}</b><span>{l.details}</span><small>{when(l.at)}</small></li>)}</ul> : <p className="admin-muted">Aún no hay acciones.</p>}</section>
  </>;
}

const EMPTY = { id: undefined as string | undefined, kind: 'channel' as TaskKind, title: '', description: '', url: '', chatId: '', reward: '100', sort: '0' };
const KIND_ICON = { channel: Megaphone, group: Users, bot: Bot } as const;

function TasksAdmin() {
  const list = useServerFn(adminTasks);
  const save = useServerFn(adminSaveTask);
  const act = useServerFn(adminTaskAction);
  const { data, loading, reload } = useLoad(() => list({ data: { initData: initData() } }), [list]);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof EMPTY, v: string) => setForm(f => ({ ...f, [k]: v }));
  async function submit(e: React.FormEvent) {
    e.preventDefault(); haptic(); setSaving(true);
    try {
      await save({ data: { initData: initData(), ...(form.id ? { id: form.id } : {}), kind: form.kind, title: form.title, description: form.description || undefined, url: form.url, chatId: form.chatId || undefined, reward: Number(form.reward), sort: Math.round(Number(form.sort) || 0), active: true } });
      toast.success(form.id ? 'Tarea actualizada' : 'Tarea creada · ya sale en Tareas'); setForm(EMPTY); reload();
    } catch (err) { toast.error(friendlyError(err, 'No se pudo guardar')); } finally { setSaving(false); }
  }
  async function action(t: AdminTask, a: 'activate' | 'pause' | 'delete') {
    if (a === 'delete' && !window.confirm(`¿Borrar «${t.title}»? Se pierde su historial de cobros.`)) return;
    try { await act({ data: { initData: initData(), id: t.id, action: a } }); toast.success(a === 'delete' ? 'Tarea borrada' : a === 'pause' ? 'Tarea pausada' : 'Tarea activada'); reload(); }
    catch (err) { toast.error(friendlyError(err)); }
  }
  const edit = (t: AdminTask) => { haptic(); setForm({ id: t.id, kind: t.kind, title: t.title, description: t.description ?? '', url: t.url, chatId: t.chat_id ?? '', reward: String(t.reward), sort: String(t.sort) }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  return <>
    <form className="admin-card admin-form" onSubmit={submit}>
      <h2>{form.id ? 'Editar tarea' : 'Nueva tarea'}</h2>
      <div className="admin-kinds">{(['channel', 'group', 'bot'] as TaskKind[]).map(k => { const I = KIND_ICON[k]; return <button type="button" key={k} className={form.kind === k ? 'on' : ''} onClick={() => set('kind', k)}><I />{TASK_KIND_LABEL[k]}</button>; })}</div>
      <p className="admin-muted">{form.kind === 'bot' ? 'El usuario abre el bot, espera 10 segundos y reclama.' : `Antes, añade a @Doggminerbot como administrador del ${form.kind === 'channel' ? 'canal' : 'grupo'}: el bot comprueba que el usuario se unió.`}</p>
      <label>Título<Input required maxLength={80} value={form.title} onChange={e => set('title', e.target.value)} placeholder={form.kind === 'bot' ? 'Prueba el bot X' : 'Únete al canal oficial'} /></label>
      <label>Descripción (opcional)<Input maxLength={160} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Noticias y sorteos del hood" /></label>
      <label>Enlace<Input required value={form.url} onChange={e => set('url', e.target.value)} placeholder={form.kind === 'bot' ? 't.me/NombreBot' : 't.me/canal o @canal'} /></label>
      {form.kind !== 'bot' && <label>ID del chat (solo si el enlace es privado t.me/+…)<Input value={form.chatId} onChange={e => set('chatId', e.target.value)} placeholder="-1001234567890" /></label>}
      <div className="admin-row2"><label>Recompensa ($DOGG)<Input required type="number" inputMode="decimal" min={1} max={100000} value={form.reward} onChange={e => set('reward', e.target.value)} /></label><label>Orden<Input type="number" value={form.sort} onChange={e => set('sort', e.target.value)} /></label></div>
      <div className="admin-actions"><Button type="submit" disabled={saving}>{saving ? <RefreshCw className="animate-spin" /> : <Check />} {form.id ? 'Guardar cambios' : 'Crear tarea'}</Button>{form.id && <Button type="button" variant="outline" onClick={() => setForm(EMPTY)}>Cancelar</Button>}</div>
    </form>
    <div className="admin-bar"><span>Tareas ({data?.length ?? 0})</span><Button size="sm" variant="outline" onClick={reload} disabled={loading}><RefreshCw className={loading ? 'animate-spin' : ''} /></Button></div>
    <div className="admin-list">{data?.length === 0 && <p className="admin-muted">Todavía no hay tareas. Crea la primera arriba.</p>}
      {data?.map(t => { const I = KIND_ICON[t.kind]; return <article key={t.id} className={`admin-item ${t.active ? '' : 'off'}`}>
        <span className="admin-ico"><I /></span>
        <div><strong>{t.title}</strong><small>{TASK_KIND_LABEL[t.kind]} · +{n(t.reward, 3)} $DOGG · {n(t.claims)} cobros{t.active ? '' : ' · pausada'}</small><small className="admin-mono">{t.url}</small></div>
        <div className="admin-btns"><Button size="icon" variant="ghost" aria-label="Editar" onClick={() => edit(t)}><Pencil /></Button><Button size="icon" variant="ghost" aria-label={t.active ? 'Pausar' : 'Activar'} onClick={() => void action(t, t.active ? 'pause' : 'activate')}>{t.active ? <Pause /> : <Play />}</Button><Button size="icon" variant="ghost" aria-label="Borrar" onClick={() => void action(t, 'delete')}><Trash2 /></Button></div>
      </article>; })}</div>
  </>;
}

function UsersAdmin() {
  const call = useServerFn(adminUsers);
  const adjust = useServerFn(adminAdjust);
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'recent' | 'balance'>('recent');
  const { data, loading, setData } = useLoad(() => call({ data: { initData: initData(), q: query, sort } }), [call, query, sort]);
  const [open, setOpen] = useState<number | null>(null);
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  async function apply(u: AdminUser, sign: 1 | -1) {
    const amount = Number(delta);
    if (!amount || amount <= 0) { toast.error('Escribe una cantidad'); return; }
    if (reason.trim().length < 2) { toast.error('Escribe el motivo'); return; }
    try {
      const r = await adjust({ data: { initData: initData(), telegramId: u.telegram_id, delta: sign * amount, reason } });
      setData(list => list?.map(x => x.telegram_id === u.telegram_id ? { ...x, balance: r.balance } : x) ?? null);
      setDelta(''); setReason(''); toast.success(`Saldo actualizado: ${n(r.balance, 3)} $DOGG`);
    } catch (e) { toast.error(friendlyError(e)); }
  }
  return <>
    <form className="admin-search" onSubmit={e => { e.preventDefault(); setQuery(q); }}><Input value={q} onChange={e => setQ(e.target.value)} placeholder="ID de Telegram, @usuario o nombre" aria-label="Buscar usuario" /><Button type="submit" size="icon" aria-label="Buscar"><Search /></Button></form>
    <div className="admin-chips"><button className={sort === 'recent' ? 'on' : ''} onClick={() => setSort('recent')}>Recientes</button><button className={sort === 'balance' ? 'on' : ''} onClick={() => setSort('balance')}>Más saldo</button>{loading && <RefreshCw className="animate-spin" />}</div>
    <div className="admin-list">{data?.length === 0 && <p className="admin-muted">Sin resultados.</p>}
      {data?.map(u => <article key={u.telegram_id} className="admin-item col">
        <button className="admin-user" onClick={() => { haptic(); setOpen(open === u.telegram_id ? null : u.telegram_id); }}>
          <span className="admin-ico">{(u.first_name || u.username || '?').slice(0, 1).toUpperCase()}</span>
          <div><strong>{u.first_name || 'Sin nombre'}{u.username ? ` · @${u.username}` : ''}</strong><small>ID {u.telegram_id} · {n(u.balance, 3)} $DOGG · {getMiner(u.miner_id).name}</small></div>
        </button>
        {open === u.telegram_id && <div className="admin-detail">
          <dl>
            <dt>Alta</dt><dd>{when(u.created_at)}</dd>
            <dt>Turnos cobrados</dt><dd>{n(u.claimed_shifts)}{u.shift_started_at ? ' · minando ahora' : ''}</dd>
            <dt>Wallet</dt><dd className="admin-mono">{u.wallet_address ? short(u.wallet_address) : '—'}</dd>
            <dt>Hold on-chain</dt><dd>{u.last_hold == null ? '—' : n(u.last_hold)}</dd>
            <dt>Verificado para retirar</dt><dd>{u.withdraw_verified_at ? `Sí · ${when(u.withdraw_verified_at)}` : 'No'}</dd>
            <dt>Invitado por</dt><dd>{u.referred_by ?? '—'}</dd>
            <dt>Referidos</dt><dd>{n(u.ref_earned, 2)} ganados · {n(u.ref_pending, 2)} sin reclamar</dd>
          </dl>
          <div className="admin-adjust"><Input type="number" inputMode="decimal" min={0} value={delta} onChange={e => setDelta(e.target.value)} placeholder="Cantidad" aria-label="Cantidad" /><Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Motivo" aria-label="Motivo" maxLength={200} /></div>
          <div className="admin-actions"><Button size="sm" onClick={() => void apply(u, 1)}><Plus /> Sumar</Button><Button size="sm" variant="outline" onClick={() => void apply(u, -1)}><Minus /> Restar</Button></div>
        </div>}
      </article>)}</div>
  </>;
}

const WD_FILTERS = [['all', 'Todos'], ['pending', 'En cola'], ['sending', 'Enviando'], ['sent', 'Enviados'], ['failed', 'Devueltos']] as const;
const WD_LABEL: Record<string, string> = { pending: 'En cola', sending: 'Enviando', sent: 'Enviado', failed: 'Devuelto' };

function WithdrawalsAdmin() {
  const call = useServerFn(adminWithdrawals);
  const act = useServerFn(adminWithdrawalAction);
  const [status, setStatus] = useState<(typeof WD_FILTERS)[number][0]>('all');
  const { data, loading, reload } = useLoad(() => call({ data: { initData: initData(), status } }), [call, status]);
  const [running, setRunning] = useState(false);
  async function run() { haptic(); setRunning(true); try { await act({ data: { initData: initData(), action: 'run' } }); toast.success('Cola procesada'); reload(); } catch (e) { toast.error(friendlyError(e)); } finally { setRunning(false); } }
  async function resolve(w: AdminWithdrawal, action: 'refund' | 'mark_sent') {
    let txHash: string | undefined;
    if (action === 'refund' && !window.confirm(`¿Devolver ${n(w.amount + w.fee)} $DOGG al usuario ${w.telegram_id}? Hazlo solo si estás seguro de que NO se envió.`)) return;
    if (action === 'mark_sent') { const v = window.prompt('Hash o enlace de la transacción (opcional):'); if (v === null) return; txHash = v; }
    try { await act({ data: { initData: initData(), action, id: w.id, ...(txHash ? { txHash } : {}) } }); toast.success(action === 'refund' ? 'Saldo devuelto' : 'Marcado como enviado'); reload(); }
    catch (e) { toast.error(friendlyError(e)); }
  }
  return <>
    <div className="admin-bar"><span>Los retiros salen solos cada 2 minutos</span><Button size="sm" onClick={() => void run()} disabled={running}>{running ? <RefreshCw className="animate-spin" /> : <Send />} Enviar ahora</Button></div>
    <div className="admin-chips">{WD_FILTERS.map(([id, label]) => <button key={id} className={status === id ? 'on' : ''} onClick={() => setStatus(id)}>{label}</button>)}{loading && <RefreshCw className="animate-spin" />}</div>
    <div className="admin-list">{data?.length === 0 && <p className="admin-muted">No hay retiros aquí.</p>}
      {data?.map(w => <article key={w.id} className="admin-item col">
        <div className="admin-wd"><strong>{n(w.amount)} $DOGG</strong><em className={`wd-${w.status}`}>{WD_LABEL[w.status] ?? w.status}</em></div>
        <small>Usuario {w.telegram_id} · {when(w.created_at)}{w.attempts > 1 ? ` · ${w.attempts} intentos` : ''}</small>
        <small className="admin-mono">A {short(w.address)}{w.tx_hash ? ` · tx ${short(w.tx_hash)}` : ''}</small>
        {w.error && <small className="admin-err">{w.error}</small>}
        {(w.status === 'pending' || w.status === 'sending') && <div className="admin-actions"><Button size="sm" variant="outline" onClick={() => void resolve(w, 'mark_sent')}><Check /> Marcar enviado</Button><Button size="sm" variant="outline" onClick={() => void resolve(w, 'refund')}><Undo2 /> Devolver</Button></div>}
      </article>)}</div>
  </>;
}
