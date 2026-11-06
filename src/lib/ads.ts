import { t } from './i18n';
// Monetag SDK (loaded in the root <head>). Only the Rewarded Interstitial is used, and only when the user taps "Ver anuncio".
export const AD_ZONE = '12183992';
type ShowAd = (opts?: { ymid?: string; requestVar?: string }) => Promise<unknown>;

function sdk(): ShowAd | null {
  const fn = (window as unknown as Record<string, unknown>)[`show_${AD_ZONE}`];
  return typeof fn === 'function' ? (fn as ShowAd) : null;
}

/** Waits for the SDK script (it loads async and may be blocked by ad blockers). */
async function waitForSdk(ms = 6000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const fn = sdk();
    if (fn) return fn;
    await new Promise(r => setTimeout(r, 250));
  }
  return null;
}

/** Rewarded interstitial. The ymid ties this ad show to a server-side ad view; Monetag sends it back in its postback. */
export async function showRewardedAd(ymid?: string) {
  const show = await waitForSdk();
  if (!show) throw new Error(t('toast.adLoad'));
  try {
    // Never hang: if the SDK promise never settles, continue after 60 s.
    await Promise.race([show(ymid ? { ymid, requestVar: 'ver-anuncio' } : undefined), new Promise(r => setTimeout(r, 60000))]);
  } catch {
    throw new Error(t('toast.adNone'));
  }
}

/** Monetag Direct Link ad, alternated with the rewarded interstitial. Opens the link and resolves once the player
 *  is back in the app and at least DIRECT_MIN_MS have passed (the server pays right after). Telegram does not always
 *  hide the app while the link is open, so it never depends only on visibility events. */
export const DIRECT_AD_URL = 'https://uplcm.com/4/12201689';
const DIRECT_MIN_MS = 8000;
export async function showDirectAd() {
  const opened = Date.now();
  const tg = window.Telegram?.WebApp as unknown as { openLink?: (u: string, o?: { try_instant_view?: boolean }) => void } | undefined;
  if (tg?.openLink) tg.openLink(DIRECT_AD_URL, { try_instant_view: false }); else window.open(DIRECT_AD_URL, '_blank');
  await new Promise<void>(resolve => {
    const check = () => { if (document.visibilityState === 'visible' && Date.now() - opened >= DIRECT_MIN_MS) { stop(); resolve(); } };
    const timer = setInterval(check, 500);
    function stop() { clearInterval(timer); document.removeEventListener('visibilitychange', check); window.removeEventListener('focus', check); }
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
  });
}
