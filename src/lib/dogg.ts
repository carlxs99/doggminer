export const JETTON = 'EQCnT_6nreJHUaxbZw7g64gkP5vx6LvSXWFboW5tYsCpLS7I';
export const SWAP = `https://dedust.io/swap/GRAM/${JETTON}`;
export const PRICE = `https://dedust.io/coins/${JETTON}`;
export const SHIFT_MS = 86400000;
export const formatDogg = (value: number) => value.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
export type Player = { balance: number; shiftStartedAt: string | null; claimedShifts: number; streak: number; lastCheckin: string | null; minerId: string; shiftAccrued: number; rateChangedAt: string | null; walletAddress?: string | null | undefined; hold?: number | undefined };
export type TelegramApp = {
  initData: string;
  initDataUnsafe?: { user?: { first_name: string; username?: string; id: number } };
  ready: () => void; expand: () => void;
  setHeaderColor?: (color: string) => void;
  HapticFeedback?: { impactOccurred: (type: 'light' | 'medium') => void; notificationOccurred: (type: 'success' | 'error') => void };
  openTelegramLink?: (url: string) => void;
};
declare global { interface Window { Telegram?: { WebApp?: TelegramApp } } }
export function haptic() { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light'); }