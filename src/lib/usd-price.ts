import { useEffect, useState } from 'react';
import { JETTON } from './dogg';

let cache: { price: number; at: number } | null = null;

/** Live $DOGG price in USD from the DeDust pair (via DexScreener); null when unavailable. */
export function useDoggUsd(): number | null {
  const [price, setPrice] = useState<number | null>(cache?.price ?? null);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (cache && Date.now() - cache.at < 60_000) { setPrice(cache.price); return; }
      try {
        const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 5000);
        const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${JETTON}`, { signal: ctl.signal });
        clearTimeout(tm);
        const j = await r.json();
        const pairs = (j?.pairs ?? []) as { priceUsd?: string; liquidity?: { usd?: number } }[];
        const best = pairs.filter(p => Number(p.priceUsd) > 0).sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
        const p = Number(best?.priceUsd);
        if (p > 0) { cache = { price: p, at: Date.now() }; if (alive) setPrice(p); }
      } catch { /* keep showing DOGG only */ }
    };
    load();
    const id = setInterval(load, 120_000);
    return () => { alive = false; clearInterval(id); };
  }, []);
  return price;
}

export function formatUsdt(v: number) {
  const d = v < 1 ? 4 : 2;
  return `≈ ${v.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d })} USDT`;
}
