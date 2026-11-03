import { useEffect, useState } from 'react';
import coin from '@/assets/dogg-coin.webp';
import { Logo, bustArt } from './hero';
import { useDogg } from './state';
import { useT } from './lang';

const MIN_MS = 900;      // long enough to read, short enough not to annoy
const MAX_MS = 15_000;   // never trap the player if something hangs

function loadImage(src: string) {
  return new Promise<void>(resolve => {
    const img = new Image();
    img.onload = img.onerror = () => resolve();
    img.src = src;
    if (img.complete) resolve();
  });
}

/** Opening screen: shown from the very first paint (also server-rendered) until the player's data and the main art are ready. */
export function Splash() {
  const { loaded } = useDogg();
  const t = useT();
  const [art, setArt] = useState(false);
  const [minDone, setMinDone] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [phase, setPhase] = useState<'show' | 'fade' | 'gone'>('show');

  useEffect(() => {
    void Promise.all([loadImage(coin), loadImage(bustArt)]).then(() => setArt(true));
    const a = setTimeout(() => setMinDone(true), MIN_MS);
    const b = setTimeout(() => setTimedOut(true), MAX_MS);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);

  const ready = (loaded && art && minDone) || timedOut;
  useEffect(() => {
    if (!ready || phase !== 'show') return;
    setPhase('fade');
    const id = setTimeout(() => setPhase('gone'), 380);
    return () => clearTimeout(id);
  }, [ready, phase]);

  if (phase === 'gone') return null;
  const progress = (loaded ? 60 : 15) + (art ? 25 : 0) + (minDone ? 15 : 0);
  return <div className={`splash ${phase === 'fade' ? 'out' : ''}`} role="status" aria-live="polite" aria-label={t('splash.loading')}>
    <div className="splash-glow" aria-hidden="true" />
    <div className="splash-logo"><Logo /></div>
    <img className="splash-coin" src={coin} alt="" width={180} height={180} aria-hidden="true" />
    <div className="splash-bar" aria-hidden="true"><i style={{ width: `${progress}%` }} /></div>
    <p>{t('splash.loading')}</p>
  </div>;
}
