ALTER TABLE public.dogg_players
  ADD COLUMN IF NOT EXISTS referred_by bigint,
  ADD COLUMN IF NOT EXISTS referral_qualified_at timestamptz,
  ADD COLUMN IF NOT EXISTS ref_pending numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ref_earned numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ref_given numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS username text;
CREATE INDEX IF NOT EXISTS dogg_players_referred_by_idx ON public.dogg_players (referred_by, created_at DESC);

-- Every wallet ever verified by an account (so a referrer can't re-use their own wallet on a fake recruit).
CREATE TABLE public.dogg_wallet_links (
  wallet_address text NOT NULL,
  telegram_id bigint NOT NULL,
  first_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (wallet_address, telegram_id)
);
GRANT ALL ON public.dogg_wallet_links TO service_role;
ALTER TABLE public.dogg_wallet_links ENABLE ROW LEVEL SECURITY;
INSERT INTO public.dogg_wallet_links (wallet_address, telegram_id)
  SELECT wallet_address, telegram_id FROM public.dogg_players WHERE wallet_address IS NOT NULL ON CONFLICT DO NOTHING;

-- A wallet can qualify only one recruit, ever.
CREATE TABLE public.dogg_referral_wallets (
  wallet_address text PRIMARY KEY,
  telegram_id bigint NOT NULL,
  referrer_id bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.dogg_referral_wallets TO service_role;
ALTER TABLE public.dogg_referral_wallets ENABLE ROW LEVEL SECURITY;

-- Recruit qualifies once its own verified wallet is linked: referrer gets +100 to claim.
CREATE OR REPLACE FUNCTION public.dogg_referral_qualify(p_telegram_id bigint)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE p public.dogg_players;
BEGIN
  SELECT * INTO p FROM public.dogg_players WHERE telegram_id = p_telegram_id FOR UPDATE;
  IF NOT FOUND OR p.referred_by IS NULL OR p.referral_qualified_at IS NOT NULL OR p.wallet_address IS NULL THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.dogg_wallet_links WHERE wallet_address = p.wallet_address AND telegram_id = p.referred_by) THEN RETURN false; END IF;
  INSERT INTO public.dogg_referral_wallets (wallet_address, telegram_id, referrer_id) VALUES (p.wallet_address, p.telegram_id, p.referred_by) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE public.dogg_players SET referral_qualified_at = now() WHERE telegram_id = p_telegram_id;
  UPDATE public.dogg_players SET ref_pending = ref_pending + 100, ref_earned = ref_earned + 100 WHERE telegram_id = p.referred_by;
  RETURN true;
END; $$;

-- First open: creates the player, keeps its Telegram name, and attaches the inviter only to a brand-new account.
CREATE OR REPLACE FUNCTION public.dogg_register(p_telegram_id bigint, p_referrer bigint, p_first_name text, p_username text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.dogg_players (telegram_id, first_name, username) VALUES (p_telegram_id, left(p_first_name, 64), left(p_username, 64))
  ON CONFLICT (telegram_id) DO UPDATE SET first_name = excluded.first_name, username = excluded.username;
  IF p_referrer IS NOT NULL AND p_referrer <> p_telegram_id THEN
    UPDATE public.dogg_players me SET referred_by = p_referrer
    WHERE me.telegram_id = p_telegram_id AND me.referred_by IS NULL AND me.claimed_shifts = 0
      AND me.created_at > now() - interval '1 hour'
      AND EXISTS (SELECT 1 FROM public.dogg_players r WHERE r.telegram_id = p_referrer AND r.created_at < me.created_at);
    IF FOUND THEN PERFORM public.dogg_referral_qualify(p_telegram_id); END IF;
  END IF;
END; $$;

-- Referral screen: stats, recent recruits and claiming the pending pot (+100 per recruit and 10% of their mining).
CREATE OR REPLACE FUNCTION public.dogg_referral(p_telegram_id bigint, p_action text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE p public.dogg_players; claimed numeric := 0; total integer; qualified integer; friends jsonb;
BEGIN
  IF p_action NOT IN ('read', 'claim') THEN RAISE EXCEPTION 'Invalid action'; END IF;
  INSERT INTO public.dogg_players (telegram_id) VALUES (p_telegram_id) ON CONFLICT DO NOTHING;
  SELECT * INTO p FROM public.dogg_players WHERE telegram_id = p_telegram_id FOR UPDATE;
  IF p_action = 'claim' THEN
    IF p.wallet_address IS NULL THEN RAISE EXCEPTION 'Vincula tu wallet en Perfil para reclamar tus recompensas de referidos.'; END IF;
    IF p.ref_pending <= 0 THEN RAISE EXCEPTION 'No tienes recompensas de referidos por reclamar.'; END IF;
    claimed := p.ref_pending;
    UPDATE public.dogg_players SET balance = balance + ref_pending, ref_pending = 0 WHERE telegram_id = p_telegram_id;
    SELECT * INTO p FROM public.dogg_players WHERE telegram_id = p_telegram_id;
  END IF;
  SELECT count(*), count(referral_qualified_at) INTO total, qualified FROM public.dogg_players WHERE referred_by = p_telegram_id;
  SELECT coalesce(jsonb_agg(jsonb_build_object('name', coalesce(f.first_name, f.username, 'Homie'), 'username', f.username, 'joinedAt', f.created_at, 'qualified', f.referral_qualified_at IS NOT NULL, 'given', f.ref_given) ORDER BY f.created_at DESC), '[]'::jsonb)
    INTO friends FROM (SELECT * FROM public.dogg_players WHERE referred_by = p_telegram_id ORDER BY created_at DESC LIMIT 30) f;
  RETURN jsonb_build_object('total', total, 'qualified', qualified, 'pending', p.ref_pending, 'earned', p.ref_earned, 'balance', p.balance, 'claimed', claimed, 'walletLinked', p.wallet_address IS NOT NULL, 'friends', friends);
END; $$;

-- Mining: on claim, a qualified recruit's inviter gets 10% of the harvest (paid by the app, not taken from the recruit).
CREATE OR REPLACE FUNCTION public.dogg_shift(p_telegram_id bigint, p_action text, p_hold numeric DEFAULT 0)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE p public.dogg_players; daily numeric; next_daily numeric; required numeric; cur_hold numeric; next_id text; stop_at timestamptz; earned numeric; downgraded text; cut numeric;
BEGIN
IF p_action NOT IN ('read','start','claim','checkin') AND p_action NOT LIKE 'miner:%' THEN RAISE EXCEPTION 'Invalid action'; END IF;
INSERT INTO public.dogg_players(telegram_id) VALUES(p_telegram_id) ON CONFLICT DO NOTHING;
SELECT * INTO p FROM public.dogg_players WHERE telegram_id=p_telegram_id FOR UPDATE;
SELECT s.daily,s.hold INTO daily,cur_hold FROM public.dogg_miner_stats(p.miner_id) s;
daily:=coalesce(daily,5); cur_hold:=coalesce(cur_hold,0);
earned:=0; stop_at:=NULL;
IF p.shift_started_at IS NOT NULL THEN
stop_at:=least(now(),p.shift_started_at+interval '24 hours');
earned:=p.shift_accrued+greatest(0,extract(epoch from(stop_at-coalesce(p.rate_changed_at,p.shift_started_at))))/86400*daily;
END IF;
IF cur_hold > coalesce(p_hold,0)+p.balance THEN
  downgraded:=public.dogg_best_miner(coalesce(p_hold,0)+p.balance);
  IF p.shift_started_at IS NOT NULL THEN
    UPDATE public.dogg_players SET miner_id=downgraded,shift_accrued=earned,rate_changed_at=stop_at WHERE telegram_id=p_telegram_id;
  ELSE
    UPDATE public.dogg_players SET miner_id=downgraded WHERE telegram_id=p_telegram_id;
  END IF;
  SELECT * INTO p FROM public.dogg_players WHERE telegram_id=p_telegram_id;
END IF;
IF p_action LIKE 'miner:%' THEN
next_id:=substring(p_action from 7);
SELECT s.daily,s.hold INTO next_daily,required FROM public.dogg_miner_stats(next_id) s;
IF next_daily IS NULL THEN RAISE EXCEPTION 'Minero no válido'; END IF;
IF required>coalesce(p_hold,0)+p.balance THEN RAISE EXCEPTION 'Necesitas % $DOGG entre tu wallet verificada y la app para este minero', required; END IF;
UPDATE public.dogg_players SET miner_id=next_id,shift_accrued=earned,rate_changed_at=stop_at WHERE telegram_id=p_telegram_id;
ELSIF p_action='start' THEN
IF p.shift_started_at IS NOT NULL THEN RAISE EXCEPTION 'Ya tienes un turno activo'; END IF;
UPDATE public.dogg_players SET shift_started_at=now(),rate_changed_at=now(),shift_accrued=0 WHERE telegram_id=p_telegram_id;
ELSIF p_action='claim' THEN
IF p.shift_started_at IS NULL OR now()<p.shift_started_at+interval '24 hours' THEN RAISE EXCEPTION 'El turno todavía no ha terminado'; END IF;
UPDATE public.dogg_players SET balance=balance+earned,claimed_shifts=claimed_shifts+1,shift_started_at=NULL,rate_changed_at=NULL,shift_accrued=0 WHERE telegram_id=p_telegram_id;
IF p.referred_by IS NOT NULL AND p.referral_qualified_at IS NOT NULL AND earned > 0 THEN
  cut := round(earned * 0.1, 4);
  UPDATE public.dogg_players SET ref_pending=ref_pending+cut, ref_earned=ref_earned+cut WHERE telegram_id=p.referred_by;
  UPDATE public.dogg_players SET ref_given=ref_given+cut WHERE telegram_id=p_telegram_id;
END IF;
ELSIF p_action='checkin' THEN
IF p.last_checkin=current_date THEN RAISE EXCEPTION 'Ya reclamaste el bonus de hoy'; END IF;
UPDATE public.dogg_players SET streak=CASE WHEN last_checkin=current_date-1 THEN(streak%7)+1 ELSE 1 END,last_checkin=current_date,balance=balance+10 WHERE telegram_id=p_telegram_id;
END IF;
SELECT * INTO p FROM public.dogg_players WHERE telegram_id=p_telegram_id;
RETURN jsonb_build_object('balance',p.balance,'shiftStartedAt',p.shift_started_at,'claimedShifts',p.claimed_shifts,'streak',p.streak,'lastCheckin',p.last_checkin,'minerId',p.miner_id,'shiftAccrued',p.shift_accrued,'rateChangedAt',p.rate_changed_at,'walletAddress',p.wallet_address,'hold',coalesce(p_hold,0),'downgraded',downgraded);
END; $function$;

REVOKE ALL ON FUNCTION public.dogg_referral_qualify(bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dogg_register(bigint, bigint, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dogg_referral(bigint, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dogg_shift(bigint, text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dogg_referral_qualify(bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.dogg_register(bigint, bigint, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.dogg_referral(bigint, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.dogg_shift(bigint, text, numeric) TO service_role;