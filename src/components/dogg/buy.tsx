import type { MouseEvent, ReactNode } from 'react';
import { toast } from 'sonner';
import { JETTON, SWAP, haptic } from '@/lib/dogg';
import { t } from '@/lib/i18n';
import { useT } from './lang';

/** Official DeDust Telegram Mini App (@dedustBot). It ignores start parameters, so it cannot open with $DOGG preselected. */
export const DEDUST_APP = 'https://t.me/dedustBot/swap';

async function copyContract() {
  try { await navigator.clipboard.writeText(JETTON); return true; } catch { /* Telegram webviews may block it */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = JETTON; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch { return false; }
}

/** Main buy action: the DeDust swap page with GRAM → $DOGG preselected, opened in Telegram's built-in browser. */
export function openDogSwap(e?: MouseEvent) {
  e?.preventDefault();
  haptic();
  const tg = window.Telegram?.WebApp;
  if (tg?.initData && tg.openLink) tg.openLink(SWAP, { try_instant_view: false });
  else window.open(SWAP, '_blank', 'noopener');
}

/** Alternative: copies the $DOGG contract, tells the user to paste it, then opens the DeDust mini app. */
export function openDedustApp(e?: MouseEvent) {
  e?.preventDefault();
  haptic();
  void copyContract().then(ok => {
    if (ok) toast.success(t('buy.copied'), { description: t('buy.copiedDesc'), duration: 6000 });
    else toast.message(t('buy.search'), { description: t('buy.searchDesc', { c: JETTON }), duration: 9000 });
  });
  const tg = window.Telegram?.WebApp;
  // Small delay so the toast is seen and the copy lands before Telegram switches apps.
  setTimeout(() => { if (tg?.initData && tg.openTelegramLink) tg.openTelegramLink(DEDUST_APP); else window.open(DEDUST_APP, '_blank', 'noopener'); }, 350);
}

export function BuyDedustLink({ className, children }: { className?: string; children: ReactNode }) {
  return <a href={SWAP} onClick={openDogSwap} className={className}>{children}</a>;
}

/** Secondary option: the official DeDust mini app (contract copied to paste). */
export function DedustWebLink({ className = 'buy-web' }: { className?: string }) {
  const tr = useT();
  return <a href={DEDUST_APP} onClick={openDedustApp} className={className}>{tr('buy.miniApp')}</a>;
}
