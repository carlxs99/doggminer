// Visual and audio flourishes: coin/leaf rain, beats and strong haptics.
const KEY = 'dogg-sound';
let ctx: AudioContext | null = null;
export function soundOn() { return typeof window !== 'undefined' && localStorage.getItem(KEY) !== 'off'; }
export function setSound(on: boolean) { localStorage.setItem(KEY, on ? 'on' : 'off'); }
function audio() {
  if (!soundOn()) return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx ??= new AC();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}
/** Deep 808-style bass hit. */
export function bass() {
  const a = audio(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain(), t = a.currentTime;
  o.type = 'sine'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.45);
  g.gain.setValueAtTime(0.7, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.62);
}
/** Short vinyl scratch made from filtered noise. */
export function scratch() {
  const a = audio(); if (!a) return;
  const len = a.sampleRate * 0.22, buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(), t = a.currentTime;
  s.buffer = buf; f.type = 'bandpass'; f.Q.value = 6;
  f.frequency.setValueAtTime(600, t); f.frequency.linearRampToValueAtTime(2600, t + 0.08); f.frequency.linearRampToValueAtTime(500, t + 0.2);
  g.gain.value = 0.35; s.connect(f).connect(g).connect(a.destination); s.start(t);
}
export function strongHaptic() {
  const h = window.Telegram?.WebApp?.HapticFeedback;
  h?.impactOccurred('heavy'); h?.notificationOccurred?.('success');
}
/** Rain of coins and leaves over the whole screen. */
export function coinRain(coinSrc: string) {
  const layer = document.createElement('div');
  layer.className = 'fx-rain'; layer.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 34; i++) {
    const leaf = i % 3 === 2;
    const el = document.createElement(leaf ? 'span' : 'img');
    if (!leaf) (el as HTMLImageElement).src = coinSrc; else el.textContent = '🌿';
    el.className = leaf ? 'fx-leaf' : 'fx-coin';
    el.style.left = `${Math.random() * 100}%`;
    el.style.animationDelay = `${Math.random() * 0.9}s`;
    el.style.animationDuration = `${1.6 + Math.random() * 1.4}s`;
    el.style.setProperty('--drift', `${(Math.random() - 0.5) * 120}px`);
    layer.appendChild(el);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 3600);
}
