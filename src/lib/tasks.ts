// Shared (browser-safe) rules for admin-created tasks.
export type TaskKind = 'channel' | 'group' | 'bot' | 'react';
export const BOT_TASK_WAIT_S = 10;
export const TASK_KIND_LABEL: Record<TaskKind, string> = { channel: 'Canal', group: 'Grupo', bot: 'Bot', react: 'Reacción' };
/** React tasks can be done again this many hours after each claim (enforced in dogg_task_start / dogg_task_claim). */
export const REACT_REPEAT_H = 24;
/** Kinds that wait 10 s after opening before they can be claimed. */
export const waitsBeforeClaim = (kind: TaskKind) => kind === 'bot' || kind === 'react';

/** When a claimed task opens again (null = never: one-time tasks). */
export function taskResetAt(kind: TaskKind, claimedAt: string | null) {
  if (kind !== 'react' || !claimedAt) return null;
  return new Date(Date.parse(claimedAt) + REACT_REPEAT_H * 3600_000).toISOString();
}

/** A task counts as done until its reset time (forever for one-time tasks). */
export function taskDone(kind: TaskKind, claimedAt: string | null, now: number) {
  if (!claimedAt) return false;
  const reset = taskResetAt(kind, claimedAt);
  return !reset || now < Date.parse(reset);
}

/** Accepts "@name", "t.me/name", "https://t.me/name?start=x"; returns a canonical https://t.me/… link or null. */
export function normalizeTelegramUrl(input: string) {
  const v = input.trim();
  if (/^@[A-Za-z0-9_]{4,32}$/.test(v)) return `https://t.me/${v.slice(1)}`;
  const m = /^(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\/(.+)$/i.exec(v);
  if (!m?.[1]) return null;
  return `https://t.me/${m[1]}`;
}

/** Bot tasks may open any HTTP(S) destination; membership tasks stay Telegram-only. */
export function normalizeTaskUrl(kind: TaskKind, input: string): string | null {
  const value = input.trim();
  if (/[\u0000-\u0020\u007f\\]/.test(value)) return null;
  const telegram = normalizeTelegramUrl(value);
  if (kind !== 'bot' && !telegram) return null;
  const candidate = telegram ?? value;
  if (!/^https?:\/\//i.test(candidate)) return null;
  try {
    const url = new URL(candidate);
    if (!url.hostname || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

/** "@username" a public t.me link points to (null for private invite links like t.me/+abc or joinchat). */
export function chatFromUrl(url: string) {
  const m = /^https:\/\/t\.me\/([A-Za-z0-9_]{4,32})(?:[/?].*)?$/.exec(url);
  return m?.[1] && !/^(joinchat|addlist|share)$/i.test(m[1]) ? `@${m[1]}` : null;
}

/** Seconds left before a bot task can be claimed. */
export function botWaitLeft(startedAt: number, now: number) {
  return Math.max(0, Math.ceil(BOT_TASK_WAIT_S - (now - startedAt) / 1000));
}
