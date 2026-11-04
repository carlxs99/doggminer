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
IF p.referred_by IS NOT NULL AND p.referral_qualified_at IS NULL THEN PERFORM public.dogg_referral_qualify(p_telegram_id); END IF;
ELSIF p_action='claim' THEN
-- Claim any time: pay what was mined so far and restart a fresh 24h shift right away.
IF p.shift_started_at IS NULL THEN RAISE EXCEPTION 'No tienes un turno activo'; END IF;
IF earned <= 0 THEN RAISE EXCEPTION 'Todavía no hay nada que recoger'; END IF;
UPDATE public.dogg_players SET balance=balance+earned,claimed_shifts=claimed_shifts+1,shift_started_at=now(),rate_changed_at=now(),shift_accrued=0 WHERE telegram_id=p_telegram_id;
IF p.referred_by IS NOT NULL THEN
  IF p.referral_qualified_at IS NULL THEN PERFORM public.dogg_referral_qualify(p_telegram_id); END IF;
  IF earned > 0 THEN
    cut := round(earned * 0.1, 4);
    UPDATE public.dogg_players SET ref_pending=ref_pending+cut, ref_earned=ref_earned+cut WHERE telegram_id=p.referred_by;
    UPDATE public.dogg_players SET ref_given=ref_given+cut WHERE telegram_id=p_telegram_id;
  END IF;
END IF;
ELSIF p_action='checkin' THEN
IF p.last_checkin=current_date THEN RAISE EXCEPTION 'Ya reclamaste el bonus de hoy'; END IF;
UPDATE public.dogg_players SET streak=CASE WHEN last_checkin=current_date-1 THEN(streak%7)+1 ELSE 1 END,last_checkin=current_date,balance=balance+10 WHERE telegram_id=p_telegram_id;
END IF;
SELECT * INTO p FROM public.dogg_players WHERE telegram_id=p_telegram_id;
RETURN jsonb_build_object('balance',p.balance,'shiftStartedAt',p.shift_started_at,'claimedShifts',p.claimed_shifts,'streak',p.streak,'lastCheckin',p.last_checkin,'minerId',p.miner_id,'shiftAccrued',p.shift_accrued,'rateChangedAt',p.rate_changed_at,'walletAddress',p.wallet_address,'hold',coalesce(p_hold,0),'downgraded',downgraded,'withdrawVerified',p.withdraw_verified_at IS NOT NULL);
END; $function$;
REVOKE ALL ON FUNCTION public.dogg_shift(bigint, text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dogg_shift(bigint, text, numeric) TO service_role;