import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { playerAction } from '@/lib/dogg.functions';
import { haptic, SHIFT_MS, type Player } from '@/lib/dogg';
import { getMiner, shiftTotal, switchMiner } from '@/lib/mining';

export type Entry = { kind: 'mining' | 'task' | 'withdraw' | 'team'; label: string; amount: number; at: number; status?: 'review' };
export const WITHDRAW_MIN = 1000; export const WITHDRAW_FEE = 70;
type State = { history: Entry[]; withdraw: (amount: number) => Promise<void>; player: Player; now: number; demo: boolean; name: string; busy: boolean; action: (action: 'start' | 'claim' | 'checkin') => Promise<void>; activateMiner: (id: string) => Promise<void>; wallet: string | null; setWallet: (address: string | null) => void; openWallet: (() => void) | null; setOpenWallet: (fn: (() => void) | null) => void };
const Context = createContext<State | null>(null);
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
  useEffect(() => {
    const app = window.Telegram?.WebApp;
    app?.ready(); app?.expand();
    setNow(Date.now());
    if (app?.initData) {
      setDemo(false); setName(app.initDataUnsafe?.user?.first_name ?? 'Homie');
      call({ data: { initData: app.initData, action: 'read' } }).then(setPlayer).catch(e => toast.error(e.message));
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
      toast.success(kind === 'start' ? 'Turno iniciado. Keep it growing 🌱' : kind === 'checkin' ? 'Bonus diario reclamado: +10 créditos' : 'Cosecha del turno reclamada');
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
      if (!demo) throw new Error('Los retiros se activarán cuando se configure la wallet de pagos.');
      setPlayer(p => ({ ...p, balance: p.balance - amount - WITHDRAW_FEE }));
      log({ kind: 'withdraw', label: 'Retiro', amount: -(amount + WITHDRAW_FEE), status: 'review' });
      toast.success('Solicitud de retiro enviada · En revisión');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'No se pudo retirar'); }
  };
  return <Context.Provider value={{ history, withdraw, player, now, demo, name, busy, action, activateMiner, wallet, setWallet, openWallet, setOpenWallet }}>{children}</Context.Provider>;
}
export function useDogg() { const state = useContext(Context); if (!state) throw new Error('DoggProvider missing'); return state; }