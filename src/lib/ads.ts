// Monetag SDK (loaded in the root <head>). Only the Rewarded Interstitial is used, and only when the user taps "Ver anuncio".
export const AD_ZONE = '12183992';
type ShowAd = () => Promise<unknown>;

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

/** Rewarded interstitial: show_12183992() resolves only after the user has watched the ad. */
export async function showRewardedAd() {
  const show = await waitForSdk();
  if (!show) throw new Error('No se pudo cargar el anuncio. Si usas un bloqueador de anuncios, desactívalo e inténtalo de nuevo.');
  try {
    await show();
  } catch {
    throw new Error('Ahora mismo no hay anuncios disponibles. Inténtalo en unos minutos.');
  }
}
