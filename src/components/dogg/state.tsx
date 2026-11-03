import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { adAction, playerAction, requestWithdraw, verifyWallet, walletChallenge } from '@/lib/dogg.functions';
import { showRewardedAd, startInAppAds } from '@/lib/ads';
import { haptic, SHIFT_MS, AD_REWARD, AD_DAILY, type Player } from '@/lib/dogg';
import { friendlyError } from '@/lib/dogg';
import { autoUpgradeId, getMiner, shiftTotal, switchMiner } from '@/lib/mining';
type ServerPlayer = Player & { downgraded?: string | null | undefined; upgraded?: string | null | undefined };
function notifyLevel(p: ServerPlayer) {
  if (p.upgraded) { toast.success(`¡Tu hold subió! Ahora minas con ${getMiner(p.upgraded).name}`); strongHaptic(); }
  else if (p.downgraded) toast.warning('Tu hold de $DOGG bajó: tu minero descendió al mejor nivel que cubre tu saldo.');
}
import { bass, coinRain, scratch, strongHaptic } from '@/lib/fx';
import coinImg from '@/assets/dogg-coin.png';

export type Entry = { kind: 'mining' | 'task' | 'withdraw' | 'team'; label: string; amount: number; at: number; status?: 'review' };
export const WITHDRAW_MIN = 1000; export const WITHDRAW_FEE = 70;
type State = { history: Entry[]; withdraw: (amount: number) => Promise<void>; player: Player; now: number; demo: boolean; name: string; busy: boolean; action: (action: 'start' | 'claim' | 'checkin') => Promise<void>; activateMiner: (id: string) => Promise<void>; wallet: string | null; setWallet: (address: string | null) => void; openWallet: (() => void) | null; setOpenWallet: (fn: (() => void) | null) => void; verifyProof: (v: WalletProof) => Promise<void>; getChallenge: () => Promise<string | null>; adsToday: number; rewardAd: () => Promise<void> };
export type WalletProof = { address: string; publicKey?: string | undefined; stateInit?: string | undefined; proof: { timestamp: number; domain: { lengthBytes: number; value: string }; payload: string; signature: string } };
// Reuse one context across hot reloads so the provider and consumers never disagree.
const g = globalThis as { __doggContext?: React.Context<State | null> };
const Context = g.__doggContext ??= createContext<State | null>(null);
export function DoggProvider({ children }: { children: ReactNode }) {
  const [player, setPlayer] = useState<Player>({ balance: 0, shiftStartedAt: null, claimedShifts: 0, streak: 0, lastCheckin: null, minerId: 'rookie-1', shiftAccrued: 0, rateChangedAt: null });
  const [now, setNow] = useState(0);
  const [demo, setDemo] = useState(true);
  const [name, setName] = useState('Homie');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<Entry[]>([]);
  const log = (e: Omit<Entry, 'at'>) => setHistory(h => [{ ...e, at: Date.now() }, ...h]);
  const [wallet, setWallet] = useState<string | null>(null);
  const [openWallet, storeOpenWallet] = useState<(() => void) | null>(null);
  const setOpenWallet = useCallback((fn: (() => void) | null) => storeOpenWallet(() => fn), []);
  const call = useServerFn(playerAction);
  const verifyCall = useServerFn(verifyWallet);
  const withdrawCall = useServerFn(requestWithdraw);
  const challengeCall = useServerFn(walletChallenge);
  const getChallenge = useCallback(async () => {
    const initData = window.Telegram?.WebApp?.initData;
    if (!initData) return null;
    try { return (await challengeCall({ data: { initData } })).payload; } catch { return null; }
  }, [challengeCall]);
  const verifyProof = useCallback(async (v: WalletProof) => {
    const initData = window.Telegram?.WebApp?.initData;
    if (!initData) return;
    try { const p = await verifyCall({ data: { initData, ...v } }); setPlayer(p); notifyLevel(p); toast.success(`Wallet vinculada · ${(p.hold ?? 0).toLocaleString('de-DE')} $DOGG en hold`); }
    catch (e) { toast.error(friendlyError(e, 'No se pudo vincular la wallet')); }
  }, [verifyCall]);
  useEffect(() => {
    let cleanup = () => {};
    let tries = 0;
    // The Telegram script can finish loading after hydration: wait for it (up to ~5s) before falling back to demo.
    const boot = () => {
      const app = window.Telegram?.WebApp;
      const inTelegram = Boolean(app?.initData) || /tgWebAppData=/.test(window.location.hash);
      if (!app && tries++ < 25) { retry = setTimeout(boot, 200); return; }
      if (!app?.initData && inTelegram && tries++ < 25) { retry = setTimeout(boot, 200); return; }
      app?.ready(); app?.expand(); try { app?.setHeaderColor?.('#070b08'); (app as unknown as { setBackgroundColor?: (c: string) => void })?.setBackgroundColor?.('#070b08'); } catch { /* older clients */ }
      (app as unknown as { setHeaderTitle?: (title: string) => void } | undefined)?.setHeaderTitle?.('$DOGG MINER');
      setNow(Date.now());
      const timer = setInterval(() => setNow(Date.now()), 100);
      if (!app?.initData) { cleanup = () => clearInterval(timer); return; }
      setDemo(false); setName(app.initDataUnsafe?.user?.first_name || app.initDataUnsafe?.user?.username || 'Homie');
      const read = (silent: boolean) => call({ data: { initData: app.initData!, action: 'read' } }).then(p => {
        setPlayer(p); notifyLevel(p);
      }).catch(e => { if (!silent) toast.error(friendlyError(e)); });
      read(false);
      const holdTimer = setInterval(() => read(true), 60000);
      const onVisible = () => { if (document.visibilityState === 'visible') read(true); };
      document.addEventListener('visibilitychange', onVisible);
      cleanup = () => { clearInterval(timer); clearInterval(holdTimer); document.removeEventListener('visibilitychange', onVisible); };
    };
    let retry: ReturnType<typeof setTimeout> | undefined;
    boot();
    return () => { clearTimeout(retry); cleanup(); };
  }, [call]);
  // Demo: the miner also rises on its own when demo credits cover a better one.
  useEffect(() => {
    if (!demo) return;
    const up = autoUpgradeId(player.minerId, player.balance, 0);
    if (up) { setPlayer(p => switchMiner(p, up, Date.now())); toast.success(`¡Subiste a ${getMiner(up).name}!`); }
  }, [demo, player.balance, player.minerId]);
  const action = async (kind: 'start' | 'claim' | 'checkin') => {
    if (busy) return;
    haptic(); setBusy(true);
    try {
      if (!demo) {
        const initData = window.Telegram?.WebApp?.initData;
        if (!initData) throw new Error('Abre la app desde Telegram.');
        { const p = await call({ data: { initData, action: kind } }); setPlayer(p); notifyLevel(p); }
      } else {
        const today = new Date().toISOString().slice(0, 10);
        if (kind === 'start') {
          if (player.shiftStartedAt) return;
          const start = new Date().toISOString();
          setPlayer(p => ({ ...p, shiftStartedAt: start, rateChangedAt: start, shiftAccrued: 0 }));
        } else if (kind === 'claim') {
          if (!player.shiftStartedAt || Date.now() - Date.parse(player.shiftStartedAt) < SHIFT_MS) throw new Error('Tu turno termina en 24 horas.');
          log({ kind: 'mining', label: 'Cobro de minería', amount: shiftTotal(player, Date.now()) });
          setPlayer(p => ({ ...p, balance: p.balance + shiftTotal(p, Date.now()), shiftStartedAt: null, rateChangedAt: null, shiftAccrued: 0, claimedShifts: p.claimedShifts + 1 }));
        } else {
          if (player.lastCheckin === today) throw new Error('Ya reclamaste el bonus de hoy.');
          log({ kind: 'task', label: 'Daily check-in', amount: 10 });
          setPlayer(p => ({ ...p, balance: p.balance + 10, streak: p.streak % 7 + 1, lastCheckin: today }));
        }
      }
      if (kind === 'claim') { coinRain(coinImg); bass(); strongHaptic(); } else { scratch(); }
      toast.success(kind === 'start' ? 'Turno prendido. Keep it growing 🌱' : kind === 'checkin' ? 'Bonus diario reclamado: +10 créditos' : 'Puff puff… cosecha cobrada 💰');
    } catch (e) { toast.error(friendlyError(e, 'No se pudo completar la acción')); }
    finally { setBusy(false); }
  };
  const activateMiner = async (id: string) => {
    if (busy || id === player.minerId) return;
    haptic(); setBusy(true);
    try {
      const miner = getMiner(id);
      if (demo) {
        if (player.balance < miner.hold) throw new Error(`Mantén ${miner.hold.toLocaleString('de-DE')} $DOGG de demo para activar este minero.`);
        setPlayer(p => switchMiner(p, id, Date.now()));
      } else {
        const initData = window.Telegram?.WebApp?.initData;
        if (!initData) throw new Error('Abre la app desde Telegram.');
        setPlayer(await call({ data: { initData, action: 'select', minerId: id } }));
      }
      setNow(Date.now()); toast.success(`${miner.name} · ${miner.daily} $DOGG/d`);
    } catch(e) { toast.error(friendlyError(e, 'No se pudo activar')); }
    finally { setBusy(false); }
  };
  const withdraw = async (amount: number) => {
    if (busy) return; haptic();
    try {
      if (!Number.isFinite(amount) || amount < WITHDRAW_MIN) throw new Error(`El mínimo de retiro es ${WITHDRAW_MIN.toLocaleString('de-DE')} $DOGG.`);
      if (!wallet) throw new Error('Conecta tu wallet TON para retirar.');
      if (amount + WITHDRAW_FEE > player.balance) throw new Error(`Saldo insuficiente: necesitas ${(amount + WITHDRAW_FEE).toLocaleString('de-DE')} $DOGG (incluye ${WITHDRAW_FEE} de comisión).`);
      if (!demo) {
        const initData = window.Telegram?.WebApp?.initData;
        if (!initData) throw new Error('Abre la app desde Telegram.');
        setBusy(true);
        try {
          const r = await withdrawCall({ data: { initData, amount: Math.floor(amount) } });
          if (r.player) { setPlayer(r.player); notifyLevel(r.player); } else setPlayer(p => ({ ...p, balance: p.balance - amount - WITHDRAW_FEE }));
          if (r.status === 'failed') throw new Error('El envío falló y se te devolvió el saldo. Inténtalo más tarde.');
          log({ kind: 'withdraw', label: 'Retiro', amount: -(amount + WITHDRAW_FEE), ...(r.status === 'sent' ? {} : { status: 'review' as const }) });
          coinRain(coinImg); bass(); strongHaptic();
          toast.success(r.status === 'sent' ? `¡${amount.toLocaleString('de-DE')} $DOGG enviados a tu wallet!` : 'Retiro en camino a tu wallet · llegará en unos minutos');
        } finally { setBusy(false); }
        return;
      }
      setPlayer(p => ({ ...p, balance: p.balance - amount - WITHDRAW_FEE }));
      log({ kind: 'withdraw', label: 'Retiro', amount: -(amount + WITHDRAW_FEE), status: 'review' });
      toast.success('Solicitud de retiro enviada · En revisión');
    } catch (e) { toast.error(friendlyError(e, 'No se pudo retirar')); }
  };
  // Ads: real Monetag rewarded ad; in Telegram the server opens a session before the ad and pays +15 after it (10/day). Demo pays preview credits.
  const [ads, setAds] = useState({ day: '', count: 0 });
  const today = new Date(now || 0).toISOString().slice(0, 10);
  const adsToday = ads.day === today ? ads.count : 0;
  const adCall = useServerFn(adAction);
  useEffect(() => { void startInAppAds(); }, []);
  useEffect(() => {
    const initData = window.Telegram?.WebApp?.initData;
    if (demo || !initData) return;
    adCall({ data: { initData, action: 'read' } }).then(r => setAds({ day: new Date().toISOString().slice(0, 10), count: r.adsToday })).catch(() => {});
  }, [demo, adCall]);
  const rewardAd = async () => {
    if (adsToday >= AD_DAILY) { toast.error(`Ya viste los ${AD_DAILY} anuncios de hoy. Vuelve mañana.`); return; }
    haptic();
    try {
      const initData = window.Telegram?.WebApp?.initData;
      if (!demo) {
        if (!initData) throw new Error('Abre la app desde Telegram.');
        await adCall({ data: { initData, action: 'start' } });
      }
      const userId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
      await showRewardedAd(userId ? String(userId) : undefined);
      const day = new Date().toISOString().slice(0, 10);
      if (!demo && initData) {
        const r = await adCall({ data: { initData, action: 'claim' } });
        setAds({ day, count: r.adsToday });
        setPlayer(p => ({ ...p, balance: r.balance }));
      } else {
        setAds({ day, count: adsToday + 1 });
        setPlayer(p => ({ ...p, balance: p.balance + AD_REWARD }));
      }
      log({ kind: 'task', label: 'Anuncio visto', amount: AD_REWARD });
      scratch(); strongHaptic(); toast.success(`+${AD_REWARD} $DOGG por ver el anuncio`);
    } catch (e) { toast.error(friendlyError(e, 'No se pudo completar el anuncio')); }
  };
  return <Context.Provider value={{ history, withdraw, player, now, demo, name, busy, action, activateMiner, wallet, setWallet, openWallet, setOpenWallet, verifyProof, getChallenge, adsToday, rewardAd }}>{children}</Context.Provider>;
}
export function useDogg() { const state = useContext(Context); if (!state) throw new Error('DoggProvider missing'); return state; }
// Changing the shared game state forces a full reload so the provider and screens stay in sync.
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload());
