import type { ReactNode } from 'react';
import bust from '@/assets/ui/dogg-bust.webp';
import bustCap from '@/assets/ui/dogg-bust-cap.webp';
import leaf from '@/assets/ui/leaf.webp';
import crown from '@/assets/ui/crown.png';

const ART = { bust, cap: bustCap, leaf } as const;

/** Graffiti "$DOGG MINER" wordmark with the gold crown. */
export function Logo({ className = '' }: { className?: string }) {
  return <span className={`dogg-logo ${className}`}><img src={crown} alt="" width={160} height={133} aria-hidden="true" /><span>$DOGG</span> <em>MINER</em></span>;
}

/** Screen header in the neon street style: big graffiti title, subtitle and the DOGG character (or a leaf) on the right. */
export function ScreenHero({ title, subtitle, art = 'bust', green = false, crowned = false }: { title: string; subtitle?: ReactNode; art?: keyof typeof ART; green?: boolean; crowned?: boolean }) {
  return <section className={`screen-hero art-${art}`}>
    <div className="screen-hero-text">
      <h1 className={green ? 'green' : ''}>{title}{crowned && <img className="hero-crown" src={crown} alt="" width={160} height={133} aria-hidden="true" />}</h1>
      {subtitle && <p>{subtitle}</p>}
    </div>
    <img className="screen-hero-art" src={ART[art]} alt={art === 'leaf' ? '' : 'DOGG, el personaje de $DOGG MINER'} width={640} height={634} />
  </section>;
}

export { leaf as leafArt, bust as bustArt };
