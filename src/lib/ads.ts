// Monetag SDK (loaded in the root <head>): one zone serves the automatic in-app interstitials and the rewarded ad of the "Ver anuncios" task.
export const AD_ZONE = '12183992';
type ShowAd = (options?: Record<string, unknown>) => Promise<unknown>;

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

/** Rewarded interstitial: resolves only after the user has watched the ad. */
export async function showRewardedAd(ymid?: string) {
  const show = await waitForSdk();
  if (!show) throw new Error('No se pudo cargar el anuncio. Si usas un bloqueador de anuncios, desactívalo e inténtalo de nuevo.');
  try {
    await show(ymid ? { ymid } : undefined);
  } catch {
    throw new Error('Ahora mismo no hay anuncios disponibles. Inténtalo en unos minutos.');
  }
}

let inAppStarted = false;
/** Automatic In-App Interstitial: 2 ads within 6 minutes, 30s apart, first after 5s; session kept across pages. */
export async function startInAppAds() {
  if (inAppStarted) return;
  inAppStarted = true;
  const show = await waitForSdk(15000);
  if (!show) return;
  try {
    await show({ type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false } });
  } catch { /* no fill: nothing to do */ }
}
