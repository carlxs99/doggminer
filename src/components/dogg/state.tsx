import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { playerAction } from '@/lib/dogg.functions';
import { haptic, SHIFT_MS, type Player } from '@/lib/dogg';

type State = { player: Player; now: number; demo: boolean; name: string; busy: boolean; action: (action: 'start' | 'claim' | 'checkin') => Promise<void>; wallet: string | null; setWallet: (address: string | null) => void; openWallet: (() => void) | null; setOpenWallet: (fn: (() => void) | null) => void };
const Context = createContext<State | null>(null);
export function DoggProvider({ children }: { children: ReactNode }) {
  const [player, setPlayer] = useState<Player>({ balance: 0, shiftStartedAt: null, claimedShifts: 0, streak: 0, lastCheckin: null });
  const [now, setNow] = useState(0);
  const [demo, setDemo] = useState(true);
  const [name, setName] = useState('Homie');
  const [busy, setBusy] = useState(false);
  const [wallet, setWallet] = useState<string | null>(null);
  const [openWallet, storeOpenWallet] = useState<(() => void) | null>(null);
  const call = useServerFn(playerAction);
  useEffect(() => {
    const app = window.Telegram?.WebApp;
    app?.ready(); app?.expand();
    setNow(Date.now());
    if (app?.initData) {
      setDemo(false); setName(app.initDataUnsafe?.user?.first_name ?? 'Homie');
      call({ data: { initData: app.initData, action: 'read' } }).then(setPlayer).catch(e => toast.error(e.message));
    }
    const timer = setInterval(() => setNow(Date.now()), 1000);
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
          setPlayer(p => ({ ...p, shiftStartedAt: new Date().toISOString() }));
        } else if (kind === 'claim') {
          if (!player.shiftStartedAt || Date.now() - Date.parse(player.shiftStartedAt) < SHIFT_MS) throw new Error('Tu turno termina en 24 horas.');
          setPlayer(p => ({ ...p, balance: p.balance + 86.4, shiftStartedAt: null, claimedShifts: p.claimedShifts + 1 }));
        } else {
          if (player.lastCheckin === today) throw new Error('Ya reclamaste el bonus de hoy.');
          setPlayer(p => ({ ...p, balance: p.balance + 10, streak: p.streak % 7 + 1, lastCheckin: today }));
        }
      }
      toast.success(kind === 'start' ? 'Turno iniciado. Keep it growing 🌱' : kind === 'checkin' ? 'Bonus diario reclamado: +10 créditos' : 'Cosecha reclamada: +86.4 créditos');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'No se pudo completar la acción'); }
    finally { setBusy(false); }
  };
  return <Context.Provider value={{ player, now, demo, name, busy, action, wallet, setWallet, openWallet, setOpenWallet: fn => storeOpenWallet(() => fn) }}>{children}</Context.Provider>;
}
export function useDogg() { const state = useContext(Context); if (!state) throw new Error('DoggProvider missing'); return state; }