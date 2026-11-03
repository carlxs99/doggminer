import type { CSSProperties, ReactNode } from 'react';
import { useT } from './lang';
import bust from '@/assets/ui/dogg-bust.webp';
import bustCap from '@/assets/ui/dogg-bust-cap.webp';
import leaf from '@/assets/ui/leaf.webp';
import crown from '@/assets/ui/crown.webp';

const ART = { bust, cap: bustCap, leaf } as const;

/** Graffiti "$DOGG MINER" wordmark with the gold crown. */
export function Logo({ className = '' }: { className?: string }) {
  return <span className={`dogg-logo ${className}`}><img src={crown} alt="" width={160} height={133} aria-hidden="true" /><span>$DOGG</span> <em>MINER</em></span>;
}

/** Rough title width in Latin-letter units: Cyrillic graffiti letters are wider, so long Russian titles shrink more. */
const titleWidth = (title: string) => [...title].reduce((w, c) => w + (/[\u0400-\u04FF]/.test(c) ? 1 : 0.75), 0);

/** Screen header in the neon street style: big graffiti title, subtitle and the DOGG character (or a leaf) on the right. */
export function ScreenHero({ title, subtitle, art = 'bust', green = false, crowned = false }: { title: string; subtitle?: ReactNode; art?: keyof typeof ART; green?: boolean; crowned?: boolean }) {
  const t = useT();
  return <section className={`screen-hero art-${art}`}>
    <div className="screen-hero-text">
      <h1 className={green ? 'green' : ''} style={{ '--chars': titleWidth(title) + (crowned ? 1 : 0) } as CSSProperties}>{title}{crowned && <img className="hero-crown" src={crown} alt="" width={160} height={133} aria-hidden="true" />}</h1>
      {subtitle && <p>{subtitle}</p>}
    </div>
    <img className="screen-hero-art" src={ART[art]} alt={art === 'leaf' ? '' : t('hero.alt')} width={640} height={634} />
  </section>;
}

export { leaf as leafArt, bust as bustArt, bustCap as bustCapArt };
