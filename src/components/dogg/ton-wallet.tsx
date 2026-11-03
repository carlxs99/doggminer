import { TonConnectUIProvider, useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useDogg } from './state';
import { t } from '@/lib/i18n';
function Bridge() {
  const [ui] = useTonConnectUI();
  const wallet = useTonWallet();
  const { setWallet, setOpenWallet, verifyProof, getChallenge, demo, player, synced } = useDogg();
  const sent = useRef<string | null>(null);
  // Set when the player taps "connect", so a missing signature after their own connect can be reported.
  const userOpened = useRef(false);
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
    // Wait for the server read: until then we don't know if this wallet is already linked, and a restored session carries no signature.
    if (demo || !synced || !wallet || !address || sent.current === address || player.walletAddress === address.toLowerCase()) return;
    sent.current = address;
    const item = wallet.connectItems?.tonProof;
    if (item && 'proof' in item) {
      userOpened.current = false;
      void verifyProof({ address, publicKey: wallet.account.publicKey, stateInit: wallet.account.walletStateInit, proof: item.proof });
      return;
    }
    // Old session of a wallet never linked to this account: drop it quietly; the next tap on "connect" includes the signature.
    const reportFail = userOpened.current;
    userOpened.current = false;
    void ui.disconnect().finally(() => { sent.current = null; });
    if (reportFail) toast.error(t('toast.walletLinkFail'));
  }, [wallet, demo, synced, player.walletAddress, verifyProof, ui]);
  useEffect(() => {
    setOpenWallet(() => { if (ui.connected) { void ui.disconnect(); } else { userOpened.current = true; void ui.openModal(); } });
    return () => setOpenWallet(null);
  }, [ui, setOpenWallet]);
  return null;
}
export default function TonWallet() {
  return <TonConnectUIProvider manifestUrl={`${window.location.origin}/api/public/ton-manifest`}><Bridge /></TonConnectUIProvider>;
}
