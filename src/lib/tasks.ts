// Shared (browser-safe) rules for admin-created tasks.
export type TaskKind = 'channel' | 'group' | 'bot';
export const BOT_TASK_WAIT_S = 10;
export const TASK_KIND_LABEL: Record<TaskKind, string> = { channel: 'Canal', group: 'Grupo', bot: 'Bot' };

/** Accepts "@name", "t.me/name", "https://t.me/name?start=x"; returns a canonical https://t.me/… link or null. */
export function normalizeTelegramUrl(input: string) {
  const v = input.trim();
  if (/^@[A-Za-z0-9_]{4,32}$/.test(v)) return `https://t.me/${v.slice(1)}`;
  const m = /^(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\/(.+)$/i.exec(v);
  if (!m?.[1]) return null;
  return `https://t.me/${m[1]}`;
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
