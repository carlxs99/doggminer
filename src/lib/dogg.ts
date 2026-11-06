import { t, translateServer } from './i18n';
export const JETTON = 'EQCnT_6nreJHUaxbZw7g64gkP5vx6LvSXWFboW5tYsCpLS7I';
export const SWAP = `https://dedust.io/swap/GRAM/${JETTON}`;
export const PRICE = `https://dedust.io/coins/${JETTON}`;
export const SHIFT_MS = 86400000;
export const AD_REWARD = 5; export const AD_DAILY = 10;
export const REF_BONUS = 100; export const REF_SHARE = 0.1;
// Recruits shown per page in the friends list; must match the LIMIT/OFFSET in public.dogg_referral.
export const REF_PAGE = 20;
export const refPages = (total: number) => Math.max(1, Math.ceil(Math.max(0, total) / REF_PAGE));
/** Direct link of the mini app in @Doggminerbot; ?startapp= reaches the app as the signed start_param. */
export const MINI_APP_LINK = 'https://t.me/Doggminerbot/miner';
export const referralLink = (telegramId: number) => `${MINI_APP_LINK}?startapp=ref_${telegramId}`;
/** Inviter id from a start_param like "ref_12345" (null for anything else). */
export function parseRef(startParam: string | null | undefined) {
  const m = /^ref_(\d{1,15})$/.exec(startParam ?? '');
  const id = m ? Number(m[1]) : 0;
  return id > 0 && Number.isSafeInteger(id) ? id : null;
}
export const formatDogg = (value: number) => value.toLocaleString('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
export type Player = { balance: number; shiftStartedAt: string | null; claimedShifts: number; streak: number; lastCheckin: string | null; minerId: string; shiftAccrued: number; rateChangedAt: string | null; walletAddress?: string | null | undefined; hold?: number | undefined; withdrawVerified?: boolean | undefined; shiftBoost?: number | undefined; turboAt?: string | null | undefined; turboDay?: string | null | undefined };
export type TelegramApp = {
  initData: string;
  initDataUnsafe?: { user?: { first_name: string; username?: string; id: number }; start_param?: string };
  ready: () => void; expand: () => void;
  setHeaderColor?: (color: string) => void;
  HapticFeedback?: { impactOccurred: (type: 'light' | 'medium' | 'heavy') => void; notificationOccurred: (type: 'success' | 'error') => void };
  openTelegramLink?: (url: string) => void;
  openLink?: (url: string, options?: { try_instant_view?: boolean }) => void;
  requestWriteAccess?: (cb?: (allowed: boolean) => void) => void;
};
declare global { interface Window { Telegram?: { WebApp?: TelegramApp } } }
export function haptic() { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light'); }/** Turns technical errors into short, human messages (no status codes). */
export function friendlyError(e: unknown, fallback = t('err.generic')) {
  const raw = e instanceof Error ? e.message : typeof e === 'string' ? e : '';
  if (!raw) return fallback;
  if (/429|rate|too many/i.test(raw)) return t('err.rate');
  if (/failed to fetch|network|load failed|timeout/i.test(raw)) return t('err.offline');
  if (/\b5\d\d\b|internal/i.test(raw)) return t('err.server');
  const clean = raw.replace(/\s*\(\d{3}\)/g, '');
  // Server messages are in Spanish: show them in the player's language when known.
  return translateServer(clean) ?? clean;
}
