import { useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Bot, Check, ExternalLink, Heart, Megaphone, RefreshCw, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useDogg } from './state';
import { claimTask, listTasks, startTask, type PlayerTask } from '@/lib/tasks.functions';
import { botWaitLeft, BOT_TASK_WAIT_S, taskResetAt, waitsBeforeClaim } from '@/lib/tasks';
import { formatDogg, friendlyError, haptic } from '@/lib/dogg';
import { scratch, strongHaptic } from '@/lib/fx';
import { useT } from './lang';

const ICON = { channel: Megaphone, group: Users, bot: Bot, react: Heart } as const;

/** "5h" / "40m" until a daily task opens again. */
function untilLabel(resetAt: string | null, now: number) {
  if (!resetAt) return null;
  const ms = Date.parse(resetAt) - now;
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3600_000);
  return h >= 1 ? `${h}h` : `${Math.max(1, Math.ceil(ms / 60_000))}m`;
}

function openLink(url: string) {
  const tg = window.Telegram?.WebApp;
  if (tg?.openTelegramLink && url.startsWith('https://t.me/')) tg.openTelegramLink(url);
  else window.open(url, '_blank', 'noopener');
}

/** Tasks the admin created: join a channel/group (checked by the bot) or open a bot for 10 s. */
let tasksCache: PlayerTask[] | null = null;
export function ClubTasks() {
  const { demo, player, applyBalance } = useDogg();
  const t = useT();
  const list = useServerFn(listTasks);
  const start = useServerFn(startTask);
  const claim = useServerFn(claimTask);
  const [tasks, setTasksState] = useState<PlayerTask[] | null>(tasksCache);
  const setTasks = (u: PlayerTask[] | null | ((p: PlayerTask[] | null) => PlayerTask[] | null)) => setTasksState(prev => { const next = typeof u === 'function' ? u(prev) : u; tasksCache = next; return next; });
  const [started, setStarted] = useState<Record<string, number>>(() => Object.fromEntries((tasksCache ?? []).filter(x => x.startedAt).map(x => [x.id, Date.parse(x.startedAt!)])));
  const [busyId, setBusyId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    const initData = window.Telegram?.WebApp?.initData;
    list({ data: initData ? { initData } : {} }).then(r => {
      if (!active) return;
      setTasks(r);
      setStarted(Object.fromEntries(r.filter(x => x.startedAt).map(x => [x.id, Date.parse(x.startedAt!)])));
    }).catch(() => { if (active && !tasksCache) setTasks([]); });
    return () => { active = false; };
  }, [demo, list]);

  const counting = (tasks ?? []).some(x => waitsBeforeClaim(x.kind) && !x.claimed && started[x.id] && botWaitLeft(started[x.id]!, now) > 0);
  useEffect(() => { if (!counting) return; const id = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(id); }, [counting]);

  if (!tasks?.length) return null;

  async function go(task: PlayerTask) {
    haptic(); openLink(task.url);
    const initData = window.Telegram?.WebApp?.initData;
    if (demo || !initData) { toast.error(t('err.openTelegram')); return; }
    try {
      const r = await start({ data: { initData, taskId: task.id } });
      const at = Date.now() - Math.max(0, Date.parse(r.serverNow) - Date.parse(r.startedAt));
      setStarted(s => ({ ...s, [task.id]: at })); setNow(Date.now());
    } catch (e) { toast.error(friendlyError(e, t('club.openFail'))); }
  }

  async function collect(task: PlayerTask) {
    haptic(); setBusyId(task.id);
    const done = (balance: number) => {
      applyBalance(balance, { kind: 'task', label: task.title, amount: task.reward });
      setTasks(ts => ts?.map(x => x.id === task.id ? { ...x, claimed: true, resetAt: taskResetAt(x.kind, new Date().toISOString()) } : x) ?? null);
      scratch(); strongHaptic(); toast.success(t('toast.taskPaid', { n: formatDogg(task.reward).replace(/,000$/, ''), title: task.title }));
    };
    try {
      const initData = window.Telegram?.WebApp?.initData;
      if (demo || !initData) { toast.error(t('err.openTelegram')); return; }
      const r = await claim({ data: { initData, taskId: task.id } });
      done(r.balance);
    } catch (e) { toast.error(friendlyError(e, t('club.verifyFail'))); }
    finally { setBusyId(null); }
  }

  return <>
    <div className="section-heading task-heading"><h2>{t('club.title')}</h2><span>{t('club.tag')}</span></div>
    <div className="task-list club-tasks">{tasks.map(task => {
      const Icon = ICON[task.kind];
      const s = started[task.id];
      const left = waitsBeforeClaim(task.kind) && s ? botWaitLeft(s, now) : 0;
      const again = task.claimed ? untilLabel(task.resetAt, Date.now()) : null;
      const hint = task.kind === 'bot' ? t('club.hintBot', { s: BOT_TASK_WAIT_S }) : task.kind === 'react' ? t('club.hintReact') : task.kind === 'channel' ? t('club.hintChannel') : t('club.hintGroup');
      return <article key={task.id} className={`task-row club-task ${task.claimed ? 'done' : ''}`}>
        <span className="task-icon"><Icon /></span>
        <div className="task-body"><div className="task-top"><h3>{task.title}</h3><small>+{formatDogg(task.reward).replace(/,000$/, '')} $DOGG</small></div><p>{task.description || hint}</p></div>
        <div className="task-action">
          {task.claimed ? <Button variant="outline" disabled><Check /> {again ? t('club.again', { t: again }) : t('club.done')}</Button>
            : !s ? <Button onClick={() => void go(task)}>{task.kind === 'bot' ? t('club.openBot') : task.kind === 'react' ? t('club.react') : t('club.join')} <ExternalLink /></Button>
            : left > 0 ? <Button variant="outline" disabled>{t('club.wait', { n: left })}</Button>
            : <><Button onClick={() => void collect(task)} disabled={busyId === task.id}>{busyId === task.id ? <RefreshCw className="animate-spin" /> : task.kind === 'bot' ? t('club.claim') : t('club.verify')}</Button>
                {task.kind !== 'bot' && <button className="task-reopen" onClick={() => openLink(task.url)}>{t('club.reopen')}</button>}</>}
        </div>
      </article>;
    })}</div>
  </>;
}
