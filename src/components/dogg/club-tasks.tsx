import { useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Bot, Check, ExternalLink, Megaphone, RefreshCw, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useDogg } from './state';
import { claimTask, listTasks, startTask, type PlayerTask } from '@/lib/tasks.functions';
import { botWaitLeft, BOT_TASK_WAIT_S } from '@/lib/tasks';
import { formatDogg, friendlyError, haptic } from '@/lib/dogg';
import { scratch, strongHaptic } from '@/lib/fx';

const ICON = { channel: Megaphone, group: Users, bot: Bot } as const;

function openLink(url: string) {
  const tg = window.Telegram?.WebApp;
  if (tg?.openTelegramLink && url.startsWith('https://t.me/')) tg.openTelegramLink(url);
  else window.open(url, '_blank', 'noopener');
}

/** Tasks the admin created: join a channel/group (checked by the bot) or open a bot for 10 s. */
export function ClubTasks() {
  const { demo, player, applyBalance } = useDogg();
  const list = useServerFn(listTasks);
  const start = useServerFn(startTask);
  const claim = useServerFn(claimTask);
  const [tasks, setTasks] = useState<PlayerTask[] | null>(null);
  const [started, setStarted] = useState<Record<string, number>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    const initData = window.Telegram?.WebApp?.initData;
    list({ data: initData ? { initData } : {} }).then(r => {
      if (!active) return;
      setTasks(r);
      setStarted(Object.fromEntries(r.filter(t => t.startedAt).map(t => [t.id, Date.parse(t.startedAt!)])));
    }).catch(() => { if (active) setTasks([]); });
    return () => { active = false; };
  }, [demo, list]);

  const counting = (tasks ?? []).some(t => t.kind === 'bot' && !t.claimed && started[t.id] && botWaitLeft(started[t.id]!, now) > 0);
  useEffect(() => { if (!counting) return; const id = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(id); }, [counting]);

  if (!tasks?.length) return null;

  async function go(t: PlayerTask) {
    haptic(); openLink(t.url);
    const initData = window.Telegram?.WebApp?.initData;
    if (demo || !initData) { setStarted(s => ({ ...s, [t.id]: s[t.id] ?? Date.now() })); setNow(Date.now()); return; }
    try {
      const r = await start({ data: { initData, taskId: t.id } });
      const at = Date.now() - Math.max(0, Date.parse(r.serverNow) - Date.parse(r.startedAt));
      setStarted(s => ({ ...s, [t.id]: at })); setNow(Date.now());
    } catch (e) { toast.error(friendlyError(e, 'No se pudo abrir la tarea')); }
  }

  async function collect(t: PlayerTask) {
    haptic(); setBusyId(t.id);
    const done = (balance: number) => {
      applyBalance(balance, { kind: 'task', label: t.title, amount: t.reward });
      setTasks(ts => ts?.map(x => x.id === t.id ? { ...x, claimed: true } : x) ?? null);
      scratch(); strongHaptic(); toast.success(`+${formatDogg(t.reward).replace(/,000$/, "")} $DOGG · ${t.title}`);
    };
    try {
      const initData = window.Telegram?.WebApp?.initData;
      if (demo || !initData) { done(player.balance + t.reward); return; }
      const r = await claim({ data: { initData, taskId: t.id } });
      done(r.balance);
    } catch (e) { toast.error(friendlyError(e, 'No se pudo verificar')); }
    finally { setBusyId(null); }
  }

  return <>
    <div className="section-heading task-heading"><h2>Tareas del club</h2><span>CANALES · GRUPOS · BOTS</span></div>
    <div className="task-list club-tasks">{tasks.map(t => {
      const Icon = ICON[t.kind];
      const s = started[t.id];
      const left = t.kind === 'bot' && s ? botWaitLeft(s, now) : 0;
      const hint = t.kind === 'bot' ? `Abre el bot, espera ${BOT_TASK_WAIT_S} s y reclama.` : `Únete al ${t.kind === 'channel' ? 'canal' : 'grupo'}; el bot comprueba que estás dentro.`;
      return <article key={t.id} className={`task-row club-task ${t.claimed ? 'done' : ''}`}>
        <span className="task-icon"><Icon /></span>
        <div className="task-body"><div className="task-top"><h3>{t.title}</h3><small>+{formatDogg(t.reward).replace(/,000$/, '')} $DOGG</small></div><p>{t.description || hint}</p></div>
        <div className="task-action">
          {t.claimed ? <Button variant="outline" disabled><Check /> Hecho</Button>
            : !s ? <Button onClick={() => void go(t)}>{t.kind === 'bot' ? 'Abrir bot' : 'Unirse'} <ExternalLink /></Button>
            : left > 0 ? <Button variant="outline" disabled>Espera {left}s</Button>
            : <><Button onClick={() => void collect(t)} disabled={busyId === t.id}>{busyId === t.id ? <RefreshCw className="animate-spin" /> : t.kind === 'bot' ? 'Reclamar' : 'Verificar'}</Button>
                {t.kind !== 'bot' && <button className="task-reopen" onClick={() => openLink(t.url)}>Abrir de nuevo</button>}</>}
        </div>
      </article>;
    })}</div>
  </>;
}
