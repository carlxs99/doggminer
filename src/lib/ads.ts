import { t } from './i18n';
// Monetag SDK (loaded in the root <head>). Only the Rewarded Interstitial is used, and only when the user taps "Ver anuncio".
export const AD_ZONE = '12183992';
type ShowAd = (opts?: { ymid?: string; requestVar?: string }) => Promise<unknown>;

function sdk(): ShowAd | null {
  const fn = (window as unknown as Record<string, unknown>)[`show_${AD_ZONE}`];
  return typeof fn === 'function' ? (fn as ShowAd) : null;
}

/** Waits for the SDK script (it loads async and may be blocked by ad blockers). */
async function waitForSdk(ms = 8000) {
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
    await show(ymid ? { ymid, requestVar: 'ver-anuncio' } : undefined);
  } catch {
    throw new Error(t('toast.adNone'));
  }
}
