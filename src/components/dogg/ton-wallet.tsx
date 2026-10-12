import { TonConnectUIProvider, useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { useEffect } from 'react';
import { useDogg } from './state';
function Bridge() {
  const [ui] = useTonConnectUI();
  const wallet = useTonWallet();
  const { setWallet, setOpenWallet } = useDogg();
  useEffect(() => { setWallet(wallet?.account.address ?? null); }, [wallet, setWallet]);
  useEffect(() => {
    setOpenWallet(() => { if (ui.connected) { void ui.disconnect(); } else { void ui.openModal(); } });
    return () => setOpenWallet(null);
  }, [ui, setOpenWallet]);
  return null;
}
export default function TonWallet() {
  return <TonConnectUIProvider manifestUrl={`${window.location.origin}/api/public/ton-manifest`}><Bridge /></TonConnectUIProvider>;
}