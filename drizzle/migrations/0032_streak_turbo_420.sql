ALTER TABLE public.dogg_players ADD COLUMN IF NOT EXISTS shift_boost numeric NOT NULL DEFAULT 1;
ALTER TABLE public.dogg_players ADD COLUMN IF NOT EXISTS turbo_at timestamptz;
ALTER TABLE public.dogg_players ADD COLUMN IF NOT EXISTS turbo_day date;
COMMENT ON COLUMN public.dogg_players.shift_boost IS 'Streak multiplier frozen when the current shift started (1, 1.05 from 3 days, 1.15 from 7 days).';
COMMENT ON COLUMN public.dogg_players.turbo_at IS 'Start of the last Turbo 420 (x2 for 15 minutes).';

CREATE OR REPLACE FUNCTION public.dogg_streak_boost(p_streak int) RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT CASE WHEN p_streak >= 7 THEN 1.15 WHEN p_streak >= 3 THEN 1.05 ELSE 1 END::numeric
$$;

CREATE OR REPLACE FUNCTION public.dogg_shift(p_telegram_id bigint, p_action text, p_hold numeric DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE p public.dogg_players; daily numeric; rate numeric; seg timestamptz; next_daily numeric; required numeric; cur_hold numeric; next_id text; stop_at timestamptz; earned numeric; downgraded text; cut numeric; new_streak int;
BEGIN
IF p_action NOT IN ('read','start','claim','turbo') AND p_action NOT LIKE 'miner:%' THEN RAISE EXCEPTION 'Invalid action'; END IF;
INSERT INTO public.dogg_players(telegram_id) VALUES(p_telegram_id) ON CONFLICT DO NOTHING;
SELECT * INTO p FROM public.dogg_players WHERE telegram_id=p_telegram_id FOR UPDATE;
SELECT s.daily,s.hold INTO daily,cur_hold FROM public.dogg_miner_stats(p.miner_id) s;
daily:=coalesce(daily,5); cur_hold:=coalesce(cur_hold,0);
earned:=0; stop_at:=NULL;
IF p.shift_started_at IS NOT NULL THEN
  stop_at:=least(now(),p.shift_started_at+interval '24 hours');
  seg:=coalesce(p.rate_changed_at,p.shift_started_at);
  rate:=daily*coalesce(p.shift_boost,1);
  earned:=p.shift_accrued+greatest(0,extract(epoch from(stop_at-seg)))/86400*rate;
  -- Turbo 420: the overlap of this segment with the 15-minute turbo window earns the rate a second time (x2).
  IF p.turbo_at IS NOT NULL THEN
    earned:=earned+greatest(0,extract(epoch from(least(stop_at,p.turbo_at+interval '15 minutes')-greatest(seg,p.turbo_at))))/86400*rate;
  END IF;
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
-- Daily streak: one step per UTC day with a start or claim; a missed day resets it.
new_streak:=CASE WHEN p.last_checkin=current_date THEN greatest(p.streak,1) WHEN p.last_checkin=current_date-1 THEN p.streak+1 ELSE 1 END;
IF p_action LIKE 'miner:%' THEN
  next_id:=substring(p_action from 7);
  SELECT s.daily,s.hold INTO next_daily,required FROM public.dogg_miner_stats(next_id) s;
  IF next_daily IS NULL THEN RAISE EXCEPTION 'Minero no válido'; END IF;
  IF required>coalesce(p_hold,0)+p.balance THEN RAISE EXCEPTION 'Necesitas % $DOGG entre tu wallet verificada y la app para este minero', required; END IF;
  UPDATE public.dogg_players SET miner_id=next_id,shift_accrued=earned,rate_changed_at=stop_at WHERE telegram_id=p_telegram_id;
ELSIF p_action='turbo' THEN
  IF p.shift_started_at IS NULL OR now()>=p.shift_started_at+interval '24 hours' THEN RAISE EXCEPTION 'Inicia un turno para activar el Turbo 420'; END IF;
  IF p.turbo_day=current_date THEN RAISE EXCEPTION 'Ya usaste el Turbo 420 hoy'; END IF;
  UPDATE public.dogg_players SET shift_accrued=earned,rate_changed_at=stop_at,turbo_at=now(),turbo_day=current_date WHERE telegram_id=p_telegram_id;
ELSIF p_action='start' THEN
  IF p.shift_started_at IS NOT NULL THEN RAISE EXCEPTION 'Ya tienes un turno activo'; END IF;
  UPDATE public.dogg_players SET shift_started_at=now(),rate_changed_at=now(),shift_accrued=0,streak=new_streak,last_checkin=current_date,shift_boost=public.dogg_streak_boost(new_streak) WHERE telegram_id=p_telegram_id;
  IF p.referred_by IS NOT NULL AND p.referral_qualified_at IS NULL THEN PERFORM public.dogg_referral_qualify(p_telegram_id); END IF;
ELSIF p_action='claim' THEN
  IF p.shift_started_at IS NULL THEN RAISE EXCEPTION 'No tienes un turno activo'; END IF;
  IF earned <= 0 THEN RAISE EXCEPTION 'Todavía no hay nada que recoger'; END IF;
  UPDATE public.dogg_players SET balance=balance+earned,claimed_shifts=claimed_shifts+1,shift_started_at=now(),rate_changed_at=now(),shift_accrued=0,streak=new_streak,last_checkin=current_date,shift_boost=public.dogg_streak_boost(new_streak) WHERE telegram_id=p_telegram_id;
  IF p.referred_by IS NOT NULL THEN
    IF p.referral_qualified_at IS NULL THEN PERFORM public.dogg_referral_qualify(p_telegram_id); END IF;
    IF earned > 0 THEN
      cut := round(earned * 0.1, 4);
      UPDATE public.dogg_players SET ref_pending=ref_pending+cut, ref_earned=ref_earned+cut WHERE telegram_id=p.referred_by;
      UPDATE public.dogg_players SET ref_given=ref_given+cut WHERE telegram_id=p_telegram_id;
    END IF;
  END IF;
END IF;
SELECT * INTO p FROM public.dogg_players WHERE telegram_id=p_telegram_id;
RETURN jsonb_build_object('balance',p.balance,'shiftStartedAt',p.shift_started_at,'claimedShifts',p.claimed_shifts,'streak',p.streak,'lastCheckin',p.last_checkin,'minerId',p.miner_id,'shiftAccrued',p.shift_accrued,'rateChangedAt',p.rate_changed_at,'walletAddress',p.wallet_address,'hold',coalesce(p_hold,0),'downgraded',downgraded,'withdrawVerified',p.withdraw_verified_at IS NOT NULL,'shiftBoost',p.shift_boost,'turboAt',p.turbo_at,'turboDay',p.turbo_day);
END; $function$;