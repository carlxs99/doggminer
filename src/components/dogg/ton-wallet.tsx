import { TonConnectUIProvider, useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { useEffect, useRef } from 'react';
import { useDogg } from './state';
function Bridge() {
  const [ui] = useTonConnectUI();
  const wallet = useTonWallet();
  const { setWallet, setOpenWallet, verifyProof, demo, player } = useDogg();
  const sent = useRef<string | null>(null);
  useEffect(() => { setWallet(wallet?.account.address ?? null); }, [wallet, setWallet]);
  // Link the connected wallet to the player so its $DOGG counts as hold.
  useEffect(() => {
    const address = wallet?.account.address;
    if (demo || !address || sent.current === address || player.walletAddress === address.toLowerCase()) return;
    sent.current = address;
    void verifyProof(address);
  }, [wallet, demo, player.walletAddress, verifyProof]);
  useEffect(() => {
    setOpenWallet(() => { if (ui.connected) { void ui.disconnect(); } else { void ui.openModal(); } });
    return () => setOpenWallet(null);
  }, [ui, setOpenWallet]);
  return null;
}
export default function TonWallet() {
  return <TonConnectUIProvider manifestUrl={`${window.location.origin}/api/public/ton-manifest`}><Bridge /></TonConnectUIProvider>;
}
