import { TonConnectUIProvider, useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useServerFn } from '@tanstack/react-start';
import { proofPayload } from '@/lib/dogg.functions';
import { useDogg } from './state';
function Bridge() {
  const [ui] = useTonConnectUI();
  const wallet = useTonWallet();
  const { setWallet, setOpenWallet, verifyProof, demo, player } = useDogg();
  const getPayload = useServerFn(proofPayload);
  const sent = useRef<string | null>(null);
  useEffect(() => { setWallet(wallet?.account.address ?? null); }, [wallet, setWallet]);
  // Ask the wallet to sign a server payload on connect so ownership can be proven.
  useEffect(() => {
    if (demo || ui.connected) return;
    ui.setConnectRequestParameters({ state: 'loading' });
    getPayload().then(({ payload }) => ui.setConnectRequestParameters({ state: 'ready', value: { tonProof: payload } })).catch(() => ui.setConnectRequestParameters(null));
  }, [ui, demo, getPayload, wallet]);
  useEffect(() => {
    const proof = wallet?.connectItems?.tonProof;
    if (!wallet || !proof || !('proof' in proof) || sent.current === proof.proof.signature) return;
    sent.current = proof.proof.signature;
    void verifyProof(wallet.account.address, proof.proof);
  }, [wallet, verifyProof]);
  // A wallet restored from an older session has no signature: reconnect it so ownership can be proven.
  const reset = useRef(false);
  useEffect(() => {
    if (demo || !wallet || player.walletAddress || reset.current) return;
    const proof = wallet.connectItems?.tonProof;
    if (proof && 'proof' in proof) return;
    reset.current = true;
    toast.info('Vuelve a conectar tu wallet y acepta la firma para verificar tu hold.');
    void ui.disconnect().then(() => setTimeout(() => void ui.openModal(), 800));
  }, [demo, wallet, player.walletAddress, ui]);
  useEffect(() => {
    setOpenWallet(() => { if (ui.connected) { void ui.disconnect(); } else { void ui.openModal(); } });
    return () => setOpenWallet(null);
  }, [ui, setOpenWallet]);
  return null;
}
export default function TonWallet() {
  return <TonConnectUIProvider manifestUrl={`${window.location.origin}/api/public/ton-manifest`}><Bridge /></TonConnectUIProvider>;
}
