import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { playerAction, requestWithdraw, verifyWallet, walletChallenge } from '@/lib/dogg.functions';
import { haptic, SHIFT_MS, type Player } from '@/lib/dogg';
import { getMiner, shiftTotal, switchMiner } from '@/lib/mining';
import { bass, coinRain, scratch, strongHaptic } from '@/lib/fx';
import coinImg from '@/assets/dogg-coin.png';

export type Entry = { kind: 'mining' | 'task' | 'withdraw' | 'team'; label: string; amount: number; at: number; status?: 'review' };
export const WITHDRAW_MIN = 1000; export const WITHDRAW_FEE = 70;
type State = { history: Entry[]; withdraw: (amount: number) => Promise<void>; player: Player; now: number; demo: boolean; name: string; busy: boolean; action: (action: 'start' | 'claim' | 'checkin') => Promise<void>; activateMiner: (id: string) => Promise<void>; wallet: string | null; setWallet: (address: string | null) => void; openWallet: (() => void) | null; setOpenWallet: (fn: (() => void) | null) => void; verifyProof: (v: WalletProof) => Promise<void>; getChallenge: () => Promise<string | null> };
export type WalletProof = { address: string; publicKey?: string; stateInit?: string; proof: { timestamp: number; domain: { lengthBytes: number; value: string }; payload: string; signature: string } };
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
    try { const p = await verifyCall({ data: { initData, ...v } }); setPlayer(p); toast.success(`Wallet vinculada · ${(p.hold ?? 0).toLocaleString('en-US')} $DOGG en hold`); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'No se pudo vincular la wallet'); }
  }, [verifyCall]);
  useEffect(() => {
    const app = window.Telegram?.WebApp;
    app?.ready(); app?.expand();
    (app as unknown as { setHeaderTitle?: (title: string) => void } | undefined)?.setHeaderTitle?.('$DOGG MINER');
    setNow(Date.now());
    if (app?.initData) {
      setDemo(false); setName(app.initDataUnsafe?.user?.first_name ?? 'Homie');
      const read = (silent: boolean) => call({ data: { initData: app.initData!, action: 'read' } }).then((p: Player & { downgraded?: string | null }) => {
        setPlayer(p);
        if (p.downgraded) toast.warning('Tu hold de $DOGG bajó: tu minero descendió al mejor nivel que cubre tu saldo.');
      }).catch(e => { if (!silent) toast.error(e.message); });
      read(false);
      const holdTimer = setInterval(() => read(true), 60000);
      const timer = setInterval(() => setNow(Date.now()), 100);
      return () => { clearInterval(timer); clearInterval(holdTimer); };
    }
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, [call]);
  const action = async (kind: 'start' | 'claim' | 'checkin') => {
    if (busy) return;
    haptic(); setBusy(true);
    try {
      if (!demo) {
        const initData = window.Telegram?.WebApp?.initData;
        if (!initData) throw new Error('Abre la app desde Telegram.');
        setPlayer(await call({ data: { initData, action: kind } }));
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
    } catch (e) { toast.error(e instanceof Error ? e.message : 'No se pudo completar la acción'); }
    finally { setBusy(false); }
  };
  const activateMiner = async (id: string) => {
    if (busy || id === player.minerId) return;
    haptic(); setBusy(true);
    try {
      const miner = getMiner(id);
      if (demo) {
        if (player.balance < miner.hold) throw new Error(`Mantén ${miner.hold.toLocaleString('en-US')} $DOGG de demo para activar este minero.`);
        setPlayer(p => switchMiner(p, id, Date.now()));
      } else {
        const initData = window.Telegram?.WebApp?.initData;
        if (!initData) throw new Error('Abre la app desde Telegram.');
        setPlayer(await call({ data: { initData, action: 'select', minerId: id } }));
      }
      setNow(Date.now()); toast.success(`${miner.name} · ${miner.daily} $DOGG/d`);
    } catch(e) { toast.error(e instanceof Error ? e.message : 'No se pudo activar'); }
    finally { setBusy(false); }
  };
  const withdraw = async (amount: number) => {
    if (busy) return; haptic();
    try {
      if (!Number.isFinite(amount) || amount < WITHDRAW_MIN) throw new Error(`El mínimo de retiro es ${WITHDRAW_MIN.toLocaleString('en-US')} $DOGG.`);
      if (!wallet) throw new Error('Conecta tu wallet TON para retirar.');
      if (amount + WITHDRAW_FEE > player.balance) throw new Error(`Saldo insuficiente: necesitas ${(amount + WITHDRAW_FEE).toLocaleString('en-US')} $DOGG (incluye ${WITHDRAW_FEE} de comisión).`);
      if (!demo) {
        const initData = window.Telegram?.WebApp?.initData;
        if (!initData) throw new Error('Abre la app desde Telegram.');
        setBusy(true);
        try {
          const r = await withdrawCall({ data: { initData, amount: Math.floor(amount) } });
          if (r.player) setPlayer(p => ({ ...r.player!, hold: p.hold, walletAddress: p.walletAddress }));
          if (r.status === 'failed') throw new Error('El envío falló y se te devolvió el saldo. Inténtalo más tarde.');
          log({ kind: 'withdraw', label: 'Retiro', amount: -(amount + WITHDRAW_FEE), ...(r.status === 'sent' ? {} : { status: 'review' as const }) });
          coinRain(coinImg); bass(); strongHaptic();
          toast.success(r.status === 'sent' ? `¡${amount.toLocaleString('en-US')} $DOGG enviados a tu wallet!` : 'Retiro en camino a tu wallet · llegará en unos minutos');
        } finally { setBusy(false); }
        return;
      }
      setPlayer(p => ({ ...p, balance: p.balance - amount - WITHDRAW_FEE }));
      log({ kind: 'withdraw', label: 'Retiro', amount: -(amount + WITHDRAW_FEE), status: 'review' });
      toast.success('Solicitud de retiro enviada · En revisión');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'No se pudo retirar'); }
  };
  return <Context.Provider value={{ history, withdraw, player, now, demo, name, busy, action, activateMiner, wallet, setWallet, openWallet, setOpenWallet, verifyProof, getChallenge }}>{children}</Context.Provider>;
}
export function useDogg() { const state = useContext(Context); if (!state) throw new Error('DoggProvider missing'); return state; }
// Changing the shared game state forces a full reload so the provider and screens stay in sync.
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload());
