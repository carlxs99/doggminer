import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { adAction, ledgerAction, playerAction, requestWithdraw, verifyPurchase, verifyWallet, walletChallenge } from '@/lib/dogg.functions';
import { VERIFY_BUY } from '@/lib/purchase';
import { showRewardedAd } from '@/lib/ads';
import { deviceSignals } from '@/lib/fingerprint';
import { friendlyAddress } from '@/lib/address';
import { haptic, SHIFT_MS, AD_REWARD, AD_DAILY, type Player } from '@/lib/dogg';
import { friendlyError } from '@/lib/dogg';
import { t } from '@/lib/i18n';
import { autoUpgradeId, getMiner, shiftTotal, switchMiner } from '@/lib/mining';
type ServerPlayer = Player & { downgraded?: string | null | undefined; upgraded?: string | null | undefined };
function notifyLevel(p: ServerPlayer) {
  if (p.upgraded) { toast.success(t('toast.upgraded', { name: getMiner(p.upgraded).name })); strongHaptic(); }
  else if (p.downgraded) toast.warning(t('toast.downgraded'));
}
import { bass, coinRain, scratch, strongHaptic } from '@/lib/fx';
import coinImg from '@/assets/dogg-coin.webp';

export type Entry = { kind: 'mining' | 'task' | 'withdraw' | 'team'; label: string; amount: number; at: number; status?: 'review' };
export const WITHDRAW_MIN = 1000; export const WITHDRAW_FEE = 70;
type State = { history: Entry[]; withdraw: (amount: number) => Promise<void>; player: Player; now: number; demo: boolean; name: string; busy: boolean; action: (action: 'start' | 'claim' | 'checkin') => Promise<void>; activateMiner: (id: string) => Promise<void>; wallet: string | null; walletLive: boolean; setWallet: (address: string | null) => void; openWallet: (() => void) | null; setOpenWallet: (fn: (() => void) | null) => void; verifyProof: (v: WalletProof) => Promise<void>; getChallenge: () => Promise<string | null>; adsToday: number; rewardAd: () => Promise<void>; applyBalance: (balance: number, entry?: Omit<Entry, 'at'>) => void; verifyBuy: () => Promise<void>; verifying: boolean; isAdmin: boolean; synced: boolean; earnedBefore: number };
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
  const [isAdmin, setIsAdmin] = useState(false);
  // True once the server has told us which wallet (if any) is already linked to this Telegram account.
  const [synced, setSynced] = useState(false);
  const [history, setHistory] = useState<Entry[]>([]);
  // Real players: history and PnL come from the server ledger (every balance movement), refreshed when the balance changes.
  const [ledger, setLedger] = useState<{ entries: Entry[]; earnedBefore: number } | null>(null);
  const log = (e: Omit<Entry, 'at'>) => setHistory(h => [{ ...e, at: Date.now() }, ...h]);
  const applyBalance = useCallback((balance: number, entry?: Omit<Entry, 'at'>) => { setPlayer(p => ({ ...p, balance })); if (entry) setHistory(h => [{ ...entry, at: Date.now() }, ...h]); }, []);
  // Live TON Connect session (may be lost when Telegram clears its storage); the account's linked wallet is saved on the server.
  const [tcWallet, setWallet] = useState<string | null>(null);
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
    try { const p = await verifyCall({ data: { initData, ...v } }); setPlayer(p); notifyLevel(p); toast.success(t('toast.walletLinked', { n: (p.hold ?? 0).toLocaleString('de-DE') })); }
    catch (e) { toast.error(friendlyError(e, t('toast.walletLinkFail'))); }
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
      // Shared clock ticks once a second; only the live counter on Minar ticks faster, locally, so the whole app doesn't re-render 10×/s.
      const timer = setInterval(() => setNow(Date.now()), 1000);
      if (!app?.initData) { cleanup = () => clearInterval(timer); return; }
      setDemo(false); setName(app.initDataUnsafe?.user?.first_name || app.initDataUnsafe?.user?.username || 'Homie');
      const read = (silent: boolean) => deviceSignals().then(device => call({ data: { initData: app.initData!, action: 'read', ...(device ? { device } : {}) } })).then(p => {
        setPlayer(p); notifyLevel(p); if ('isAdmin' in p) setIsAdmin(Boolean(p.isAdmin)); setSynced(true);
      }).catch(e => { if (!silent) toast.error(friendlyError(e)); });
      read(false);
      // Ask once for permission to message the player (withdrawal and referral notices from the bot).
      const askWrite = setTimeout(() => {
        try { if (!localStorage.getItem('dogg-write-access')) app.requestWriteAccess?.(ok => localStorage.setItem('dogg-write-access', ok ? '1' : '0')); } catch { /* older clients */ }
      }, 6000);
      const holdTimer = setInterval(() => read(true), 60000);
      const onVisible = () => { if (document.visibilityState === 'visible') read(true); };
      document.addEventListener('visibilitychange', onVisible);
      cleanup = () => { clearTimeout(askWrite); clearInterval(timer); clearInterval(holdTimer); document.removeEventListener('visibilitychange', onVisible); };
    };
    let retry: ReturnType<typeof setTimeout> | undefined;
    boot();
    return () => { clearTimeout(retry); cleanup(); };
  }, [call]);
  const ledgerCall = useServerFn(ledgerAction);
  useEffect(() => {
    const initData = window.Telegram?.WebApp?.initData;
    if (demo || !synced || !initData) return;
    let alive = true;
    const load = () => ledgerCall({ data: { initData } }).then(r => { if (alive) setLedger(r); }).catch(() => { /* keep the last copy */ });
    const first = setTimeout(load, 600); // let the balance settle after an action
    const poll = setInterval(load, 120_000); // withdrawal statuses change without a balance change
    return () => { alive = false; clearTimeout(first); clearInterval(poll); };
  }, [demo, synced, player.balance, ledgerCall]);
  const action = async (kind: 'start' | 'claim' | 'checkin') => {
    if (busy) return;
    haptic(); setBusy(true);
    try {
      const initData = window.Telegram?.WebApp?.initData;
      if (!initData) throw new Error(t('err.openTelegram'));
      { const p = await call({ data: { initData, action: kind } }); setPlayer(p); notifyLevel(p); }
      if (kind === 'claim') { coinRain(coinImg); bass(); strongHaptic(); } else { scratch(); }
      toast.success(kind === 'start' ? t('toast.shiftOn') : kind === 'checkin' ? t('toast.checkin') : t('toast.harvest'));
    } catch (e) { toast.error(friendlyError(e, t('toast.actionFail'))); }
    finally { setBusy(false); }
  };
  const activateMiner = async (id: string) => {
    if (busy || id === player.minerId) return;
    haptic(); setBusy(true);
    try {
      const miner = getMiner(id);
      const initData = window.Telegram?.WebApp?.initData;
      if (!initData) throw new Error(t('err.openTelegram'));
      setPlayer(await call({ data: { initData, action: 'select', minerId: id } }));
      setNow(Date.now()); toast.success(`${miner.name} · ${miner.daily} $DOGG/d`);
    } catch(e) { toast.error(friendlyError(e, t('toast.activateFail'))); }
    finally { setBusy(false); }
  };
  const withdraw = async (amount: number) => {
    if (busy) return; haptic();
    try {
      if (!Number.isFinite(amount) || amount < WITHDRAW_MIN) throw new Error(t('toast.minWithdraw', { n: WITHDRAW_MIN.toLocaleString('de-DE') }));
      if (demo) throw new Error(t('err.openTelegram'));
      if (!player.walletAddress) throw new Error(t('toast.connectToWithdraw'));
      if (!player.withdrawVerified) throw new Error(t('toast.verifyToWithdraw', { n: VERIFY_BUY }));
      if (amount + WITHDRAW_FEE > player.balance) throw new Error(t('toast.insufficient', { n: (amount + WITHDRAW_FEE).toLocaleString('de-DE'), fee: WITHDRAW_FEE }));
      const initData = window.Telegram?.WebApp?.initData;
      if (!initData) throw new Error(t('err.openTelegram'));
      setBusy(true);
      try {
        const r = await withdrawCall({ data: { initData, amount: Math.floor(amount) } });
        if (r.player) { setPlayer(r.player); notifyLevel(r.player); } else setPlayer(p => ({ ...p, balance: p.balance - amount - WITHDRAW_FEE }));
        if (r.status === 'failed') throw new Error(t('toast.wdFailed'));
        log({ kind: 'withdraw', label: 'hist.withdraw', amount: -(amount + WITHDRAW_FEE), ...(r.status === 'sent' ? {} : { status: 'review' as const }) });
        coinRain(coinImg); bass(); strongHaptic();
        toast.success(r.status === 'sent' ? t('toast.wdSent', { n: amount.toLocaleString('de-DE') }) : t('toast.wdOnWay'));
      } finally { setBusy(false); }
    } catch (e) { toast.error(friendlyError(e, t('toast.wdFail'))); }
  };
  // Withdrawal verification: the server checks that the linked wallet bought >= 100 $DOGG (one time, permanent).
  const purchaseCall = useServerFn(verifyPurchase);
  const [verifying, setVerifying] = useState(false);
  const verifyBuy = async () => {
    if (verifying) return; haptic();
    const initData = window.Telegram?.WebApp?.initData;
    if (!initData) { toast.error(t('err.openTelegram')); return; }
    setVerifying(true);
    try { const p = await purchaseCall({ data: { initData } }); setPlayer(p); notifyLevel(p); strongHaptic(); toast.success(t('toast.verifyOk')); }
    catch (e) { toast.error(friendlyError(e, t('toast.verifyFail'))); }
    finally { setVerifying(false); }
  };
  // Ads: real Monetag rewarded ad. In Telegram the server opens an ad view (ymid) and Monetag's postback pays +15 (10/day);
  // the app only polls the result.
  const [ads, setAds] = useState({ day: '', count: 0 });
  const today = new Date(now || 0).toISOString().slice(0, 10);
  const adsToday = ads.day === today ? ads.count : 0;
  const adCall = useServerFn(adAction);
  useEffect(() => {
    const initData = window.Telegram?.WebApp?.initData;
    if (demo || !initData) return;
    adCall({ data: { initData, action: 'read' } }).then(r => setAds({ day: new Date().toISOString().slice(0, 10), count: r.adsToday })).catch(() => {});
  }, [demo, adCall]);
  const paidAd = () => { log({ kind: 'task', label: 'hist.ad', amount: AD_REWARD }); scratch(); strongHaptic(); toast.success(t('toast.adPaid', { r: AD_REWARD })); };
  const rewardAd = async () => {
    if (adsToday >= AD_DAILY) { toast.error(t('toast.adsCap', { n: AD_DAILY })); return; }
    haptic();
    try {
      const initData = window.Telegram?.WebApp?.initData;
      const day = new Date().toISOString().slice(0, 10);
      if (!initData) throw new Error(t('err.openTelegram'));
      const { ymid } = await adCall({ data: { initData, action: 'start' } });
      if (!ymid) throw new Error(t('toast.adPrepFail'));
      await showRewardedAd(ymid);
      // Wait for Monetag's server confirmation (usually a few seconds).
      const end = Date.now() + 25000;
      let last = 'pending';
      while (Date.now() < end) {
        await new Promise(r => setTimeout(r, 2000));
        const r = await adCall({ data: { initData, action: 'status', ymid } }).catch(() => null);
        if (!r) continue;
        last = r.status ?? 'pending';
        if (r.status === 'paid') { setAds({ day, count: r.adsToday }); setPlayer(p => ({ ...p, balance: r.balance })); paidAd(); return; }
        if (r.status === 'capped') { setAds({ day, count: r.adsToday }); toast.error(t('toast.adsCap', { n: AD_DAILY })); return; }
        if (r.status !== 'pending' && r.status !== 'not_valued') { toast.error(t('toast.adNotValid')); return; }
      }
      if (last === 'not_valued') toast.error(t('toast.adNotValued'));
      else toast.message(t('toast.adPending'), { description: t('toast.adPendingDesc', { r: AD_REWARD }) });
    } catch (e) { toast.error(friendlyError(e, t('toast.adFail'))); }
  };
  const shown = !demo && ledger ? ledger.entries : history;
  // The wallet linked to the account (server) counts even without a live session, so players never reconnect to mine, verify or withdraw.
  const linkedWallet = !demo && player.walletAddress ? friendlyAddress(player.walletAddress) : null;
  const wallet = (tcWallet ? friendlyAddress(tcWallet) : null) ?? linkedWallet;
  return <Context.Provider value={{ history: shown, earnedBefore: !demo && ledger ? ledger.earnedBefore : 0, withdraw, player, now, demo, name, busy, action, activateMiner, wallet, walletLive: Boolean(tcWallet), setWallet, openWallet, setOpenWallet, verifyProof, getChallenge, adsToday, rewardAd, applyBalance, verifyBuy, verifying, isAdmin, synced }}>{children}</Context.Provider>;
}
export function useDogg() { const state = useContext(Context); if (!state) throw new Error('DoggProvider missing'); return state; }
// Changing the shared game state forces a full reload so the provider and screens stay in sync.
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload());
