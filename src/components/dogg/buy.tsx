import type { MouseEvent, ReactNode } from 'react';
import { toast } from 'sonner';
import { JETTON, SWAP, haptic } from '@/lib/dogg';
import { t } from '@/lib/i18n';
import { useT } from './lang';

/** Official DeDust Telegram Mini App (@dedustBot), so buying happens inside Telegram. */
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

/** Copies the $DOGG contract, tells the user to paste it in DeDust, then opens the DeDust mini app. */
export function openDedust(e?: MouseEvent) {
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
  return <a href={DEDUST_APP} onClick={openDedust} className={className}>{children}</a>;
}

/** Secondary option: the DeDust website with $DOGG preselected. */
export function DedustWebLink({ className = 'buy-web' }: { className?: string }) {
  const tr = useT();
  return <a href={SWAP} target="_blank" rel="noopener noreferrer" className={className}>{tr('buy.web')}</a>;
}
