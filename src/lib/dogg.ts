export const JETTON = 'EQCnT_6nreJHUaxbZw7g64gkP5vx6LvSXWFboW5tYsCpLS7I';
export const SWAP = `https://dedust.io/swap/GRAM/${JETTON}`;
export const PRICE = `https://dedust.io/coins/${JETTON}`;
export const SHIFT_MS = 86400000;
export const AD_REWARD = 15; export const AD_DAILY = 10;
export const REF_BONUS = 100; export const REF_SHARE = 0.1;
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
export type Player = { balance: number; shiftStartedAt: string | null; claimedShifts: number; streak: number; lastCheckin: string | null; minerId: string; shiftAccrued: number; rateChangedAt: string | null; walletAddress?: string | null | undefined; hold?: number | undefined };
export type TelegramApp = {
  initData: string;
  initDataUnsafe?: { user?: { first_name: string; username?: string; id: number }; start_param?: string };
  ready: () => void; expand: () => void;
  setHeaderColor?: (color: string) => void;
  HapticFeedback?: { impactOccurred: (type: 'light' | 'medium' | 'heavy') => void; notificationOccurred: (type: 'success' | 'error') => void };
  openTelegramLink?: (url: string) => void;
};
declare global { interface Window { Telegram?: { WebApp?: TelegramApp } } }
export function haptic() { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light'); }/** Turns technical errors into short, human messages (no status codes). */
export function friendlyError(e: unknown, fallback = 'Algo salió mal. Inténtalo de nuevo.') {
  const raw = e instanceof Error ? e.message : typeof e === 'string' ? e : '';
  if (!raw) return fallback;
  if (/429|rate|too many/i.test(raw)) return 'Mucho tráfico ahora mismo. Espera unos segundos y vuelve a intentarlo.';
  if (/failed to fetch|network|load failed|timeout/i.test(raw)) return 'Sin conexión. Revisa tu internet e inténtalo de nuevo.';
  if (/\b5\d\d\b|internal/i.test(raw)) return 'El servicio no responde ahora mismo. Inténtalo en un momento.';
  return raw.replace(/\s*\(\d{3}\)/g, '');
}
