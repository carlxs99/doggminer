import { useCallback, useEffect, useRef, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { Flame, RefreshCw, Share2, Swords, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { smokeAction } from '@/lib/smoke.functions';
import { SMOKE_BETS, smokeChallengeLink, smokePayout, type SmokeResponse, type SmokeRoom } from '@/lib/smoke';
import { translateServer } from '@/lib/i18n';
import { haptic } from '@/lib/dogg';
import { useDogg } from './state';
import { useT } from './lang';
import mascot from '@/assets/ui/dogg-bust.webp';
import blunt from '@/assets/games/blunt.webp';

export function SmokeBattle({ challenge }: { challenge: string | null }) {
  const { demo, player, applyBalance } = useDogg();
  const t = useT();
  const call = useServerFn(smokeAction);
  const queryClient = useQueryClient();
  const [data, setData] = useState<SmokeResponse | null>(null);
  const [selected, setSelected] = useState<string | null>(challenge);
  const [bet, setBet] = useState<10 | 25 | 50 | 100>(10);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!demo);
  const [failed, setFailed] = useState(false);
  const [power, setPower] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [now, setNow] = useState(Date.now());
  const timer = useRef<{ start: number; duration: number } | null>(null);
  const holding = useRef(false);
  const operating = useRef(false);
  const finishRef = useRef<() => void>(() => undefined);
  const room = data?.room ?? null;
  const active = room && ['preparing', 'open', 'playing'].includes(room.status) && room.role !== 'visitor';
  const canPuff = room && ((room.role === 'host' && room.status === 'preparing') || (room.role === 'guest' && room.status === 'playing'));
  const fmt = (n: number) => n.toLocaleString(t.locale, { maximumFractionDigits: 2 });

  const read = useCallback(async (id?: string | null) => {
    const initData = window.Telegram?.WebApp?.initData;
    if (demo || !initData || operating.current) return;
    try {
      const result = await call({ data: { initData, action: 'read', ...((id ?? selected) ? { room: id ?? selected ?? undefined } : {}) } });
      if (operating.current) return;
      setData(result); applyBalance(result.balance); setFailed(false);
    } catch { setFailed(true); }
    finally { setLoading(false); }
  }, [demo, selected, call, applyBalance]);

  useEffect(() => {
    void read();
    const interval = window.setInterval(() => { if (!document.hidden && !timer.current) void read(); }, 8000);
    const onFocus = () => { if (!timer.current) void read(); };
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(interval); window.removeEventListener('focus', onFocus); };
  }, [read]);
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const clock = timer.current;
      if (clock) {
        const elapsed = performance.now() - clock.start;
        setCountdown(Math.max(0, Math.ceil(-elapsed / 1000)));
        setPower(Math.min(100, Math.max(0, elapsed / clock.duration * 100)));
        if (elapsed >= clock.duration + 150) { timer.current = null; finishRef.current(); }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    if (room && ['won', 'draw'].includes(room.status)) void queryClient.invalidateQueries({ queryKey: ['global-game-history', 'battle'] });
  }, [room?.id, room?.status, queryClient]);

  async function run(action: 'create' | 'join' | 'cancel' | 'start' | 'finish', id?: string) {
    const initData = window.Telegram?.WebApp?.initData;
    if (demo || !initData) { toast.info(t('games.openTg')); return; }
    if (operating.current) return;
    operating.current = true; setBusy(true); haptic();
    const requested = performance.now();
    try {
      const result = await call({ data: { initData, action, ...(action === 'create' ? { bet } : { room: id ?? room?.id }) } });
      setData(result); applyBalance(result.balance); setSelected(result.room?.id ?? null); setFailed(false);
      if (action === 'start' && result.clock) {
        const received = performance.now();
        // Server clock only: latency estimate aligns the visual meter, never determines the paid score.
        timer.current = { start: received + result.clock.start - result.clock.now - (received - requested) / 2, duration: result.clock.duration };
        setPower(0);
      }
    } catch (e) {
      toast.error(translateServer(e instanceof Error ? e.message : '') ?? t('games.error'));
      holding.current = false; timer.current = null;
    } finally {
      operating.current = false; setBusy(false);
      if (action === 'start' && timer.current && !holding.current) release();
    }
  }
  finishRef.current = () => { holding.current = false; void run('finish'); };
  function release() {
    holding.current = false;
    const clock = timer.current;
    if (!clock) return;
    timer.current = null;
    const delay = Math.max(0, clock.start - performance.now() + 150);
    // A release during countdown submits a zero-power puff once the server timer opens.
    window.setTimeout(() => finishRef.current(), delay);
  }
  function press() {
    if (!canPuff || busy || room?.started) return;
    holding.current = true;
    void run('start');
  }
  async function share() {
    if (!room) return;
    const url = smokeChallengeLink(room.id);
    const link = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(t('battle.invite', { n: room.bet }))}`;
    if (window.Telegram?.WebApp?.openTelegramLink) window.Telegram.WebApp.openTelegramLink(link);
    else {
      try { await navigator.clipboard.writeText(url); toast.success(t('battle.copied')); }
      catch { toast.error(t('shell.copyFail')); }
    }
  }
  const name = (value: string | null | undefined) => value || t('games.historyUnknownPlayer');
  const remaining = room ? Math.max(0, Math.ceil((new Date(room.expires_at).getTime() - now) / 1000)) : 0;
  const ended = room && ['won', 'draw', 'cancelled'].includes(room.status);
  const choose = (r: SmokeRoom) => { setSelected(r.id); void read(r.id); };

  return <section className="mines-card battle-card">
    <header className="mines-head"><div><span className="mines-tag"><Swords /> PvP</span><h2>SMOKE BATTLE</h2></div><div className="mines-bal"><small>{t('games.balance')}</small><strong>{fmt(player.balance)}</strong><span>$DOGG</span></div></header>
    <div className={`battle-stage ${timer.current ? 'inhaling' : ''} ${ended ? 'revealed' : ''}`}>
      <div className="battle-fighter"><img src={mascot} alt="" width={140} height={160} /><strong dir="auto">{name(room?.host_name)}</strong>{ended && room.host_score !== null && <b>{room.host_score}</b>}</div>
      <div className="battle-versus"><Swords /><b>VS</b><img src={blunt} alt="" width={80} height={80} /></div>
      <div className="battle-fighter rival"><img src={mascot} alt="" width={140} height={160} /><strong dir="auto">{room?.guest_name ? name(room.guest_name) : t('battle.rival')}</strong>{ended && room.guest_score !== null && <b>{room.guest_score}</b>}</div>
      <i className="battle-cloud left" aria-hidden /><i className="battle-cloud right" aria-hidden />
    </div>
    <div className="battle-summary"><span>{t('battle.pot')} <b>{fmt((room?.bet ?? bet) * 2)} $DOGG</b></span><span>{t('battle.prize')} <b>{fmt(smokePayout(room?.bet ?? bet))} $DOGG</b></span></div>
    {loading && <p className="game-history-empty" role="status">{t('battle.loading')}</p>}
    {failed && <div className="battle-message" role="alert">{t('games.historyError')}<Button variant="ghost" size="icon" aria-label={t('games.historyRefresh')} onClick={() => void read()}><RefreshCw /></Button></div>}
    {room && <div className="battle-message" role="status">
      {ended ? <strong className={room.outcome === 'win' ? 'text-primary' : 'text-gold'}>{room.status === 'cancelled' ? t('battle.refunded') : room.outcome === 'win' ? t('battle.won', { n: fmt(room.payout) }) : room.outcome === 'draw' ? t('battle.draw') : t('battle.lost')}</strong> : <><strong>{t(room.status === 'open' ? 'battle.waiting' : 'battle.turn')}</strong><time>{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</time></>}
    </div>}
    {canPuff && <>
      <div className="battle-meter" role="progressbar" aria-label={t('battle.power')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(power)}><span className="battle-zone" /><i style={{ width: `${power}%` }} /><b style={{ left: `${power}%` }} /></div>
      <div className="battle-meter-label"><span>{t('battle.power')} {Math.round(power)}%</span><strong>{t('battle.perfect')}</strong></div>
      {room.started && !timer.current ? <Button className="mines-play" disabled={busy} onClick={() => void run('finish')}><Flame /> {t('battle.finish')}</Button> : <Button className="mines-play battle-hold" aria-disabled={busy && !timer.current} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); press(); }} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={() => { if (holding.current) release(); }} onKeyDown={e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); press(); } }} onKeyUp={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); release(); } }} onContextMenu={e => e.preventDefault()}><Flame />{timer.current ? (countdown > 0 ? t('battle.countdown', { n: countdown }) : t('battle.release')) : t('battle.hold')}</Button>}
    </>}
    {room?.status === 'open' && room.role === 'host' && <Button className="mines-play" onClick={() => void share()}><Share2 /> {t('battle.share')}</Button>}
    {room?.status === 'open' && room.role === 'visitor' && <Button className="mines-play" disabled={busy} onClick={() => void run('join', room.id)}><Swords /> {t('battle.join', { n: room.bet })}</Button>}
    {room?.role === 'host' && ['preparing', 'open'].includes(room.status) && <Button variant="ghost" className="w-full" disabled={busy} onClick={() => void run('cancel')}><X /> {t('battle.cancel')}</Button>}
    {!active && <>
      <div className="mines-pick"><small>{t('games.bet')}</small><div>{SMOKE_BETS.map(b => <Button key={b} variant="outline" aria-pressed={bet === b} className={bet === b ? 'on' : ''} disabled={busy} onClick={() => setBet(b)}>{b}</Button>)}</div></div>
      <Button className="mines-play" disabled={busy || loading} onClick={() => void run('create')}><Swords /> {t('battle.create', { n: bet })}</Button>
    </>}
    <p className="mines-rules">{t('battle.rules')}</p>
    <header className="battle-rooms-head"><h3><Swords /> {t('battle.rooms')}</h3><Button variant="ghost" size="icon" aria-label={t('games.historyRefresh')} disabled={busy} onClick={() => demo ? toast.info(t('games.openTg')) : void read()}><RefreshCw /></Button></header>
    <div className="battle-rooms">{data?.rooms.filter(r => r.status === 'open' && r.id !== room?.id).map(r => <div className="battle-room" key={r.id}><div><strong dir="auto">{name(r.host_name)}</strong><small>{r.bet} $DOGG · {t('battle.prize')} {fmt(smokePayout(r.bet))}</small></div><Button size="sm" variant="outline" disabled={busy || !!active} onClick={() => choose(r)}><Swords /> {t('battle.challenge')}</Button></div>)}</div>
    {!data?.rooms.some(r => r.status === 'open' && r.id !== room?.id) && <p className="game-history-empty">{t('battle.empty')}</p>}
  </section>;
}