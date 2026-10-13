import { TonConnectUIProvider, useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useDogg } from './state';
function Bridge() {
  const [ui] = useTonConnectUI();
  const wallet = useTonWallet();
  const { setWallet, setOpenWallet, verifyProof, getChallenge, demo, player } = useDogg();
  const sent = useRef<string | null>(null);
  useEffect(() => { setWallet(wallet?.account.address ?? null); }, [wallet, setWallet]);
  // Ask the wallet for a free ownership signature (ton_proof) bound to this Telegram account.
  useEffect(() => {
    if (demo) return;
    let alive = true;
    const refresh = async () => {
      ui.setConnectRequestParameters({ state: 'loading' });
      const payload = await getChallenge();
      if (!alive) return;
      ui.setConnectRequestParameters(payload ? { state: 'ready', value: { tonProof: payload } } : null);
    };
    void refresh();
    const t = setInterval(refresh, 10 * 60_000);
    return () => { alive = false; clearInterval(t); };
  }, [ui, demo, getChallenge]);
  useEffect(() => {
    const address = wallet?.account.address;
    if (demo || !wallet || !address || sent.current === address || player.walletAddress === address.toLowerCase()) return;
    sent.current = address;
    const item = wallet.connectItems?.tonProof;
    if (item && 'proof' in item) {
      void verifyProof({ address, publicKey: wallet.account.publicKey, stateInit: wallet.account.walletStateInit, proof: item.proof });
    } else {
      toast.info('Vuelve a conectar tu wallet y acepta la firma (gratis) para verificar que es tuya.');
      void ui.disconnect().then(() => { sent.current = null; void ui.openModal(); });
    }
  }, [wallet, demo, player.walletAddress, verifyProof, ui]);
  useEffect(() => {
    setOpenWallet(() => { if (ui.connected) { void ui.disconnect(); } else { void ui.openModal(); } });
    return () => setOpenWallet(null);
  }, [ui, setOpenWallet]);
  return null;
}
export default function TonWallet() {
  return <TonConnectUIProvider manifestUrl={`${window.location.origin}/api/public/ton-manifest`}><Bridge /></TonConnectUIProvider>;
}
