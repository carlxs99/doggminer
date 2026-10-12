ALTER TABLE public.dogg_players ADD COLUMN miner_id text NOT NULL DEFAULT 'rookie-1', ADD COLUMN shift_accrued numeric NOT NULL DEFAULT 0, ADD COLUMN rate_changed_at timestamptz;
UPDATE public.dogg_players SET shift_accrued=least(86400,greatest(0,extract(epoch from(now()-shift_started_at))))*0.001, rate_changed_at=least(now(),shift_started_at+interval '24 hours') WHERE shift_started_at IS NOT NULL;
CREATE OR REPLACE FUNCTION public.dogg_shift(p_telegram_id bigint,p_action text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.dogg_players; daily numeric; next_daily numeric; required numeric; next_id text; stop_at timestamptz; earned numeric;
BEGIN
IF p_action NOT IN ('read','start','claim','checkin') AND p_action NOT LIKE 'miner:%' THEN RAISE EXCEPTION 'Invalid action'; END IF;
INSERT INTO public.dogg_players(telegram_id) VALUES(p_telegram_id) ON CONFLICT DO NOTHING;
SELECT * INTO p FROM public.dogg_players WHERE telegram_id=p_telegram_id FOR UPDATE;
daily:=CASE p.miner_id WHEN 'rookie-1' THEN 5 WHEN 'rookie-2' THEN 6 WHEN 'rookie-3' THEN 6.75 WHEN 'rookie-4' THEN 7.5 WHEN 'og-grower' THEN 25 WHEN 'lowrider' THEN 50 WHEN 'magma' THEN 125 WHEN 'kingpin' THEN 250 ELSE 5 END;
earned:=0;
IF p.shift_started_at IS NOT NULL THEN
stop_at:=least(now(),p.shift_started_at+interval '24 hours');
earned:=p.shift_accrued+greatest(0,extract(epoch from(stop_at-coalesce(p.rate_changed_at,p.shift_started_at))))/86400*daily;
END IF;
IF p_action LIKE 'miner:%' THEN
next_id:=substring(p_action from 7);
SELECT v.d,v.h INTO next_daily,required FROM (VALUES ('rookie-1',5::numeric,0::numeric),('rookie-2',6,10),('rookie-3',6.75,100),('rookie-4',7.5,1000),('og-grower',25,10000),('lowrider',50,50000),('magma',125,100000),('kingpin',250,250000)) v(id,d,h) WHERE v.id=next_id;
IF next_daily IS NULL THEN RAISE EXCEPTION 'Minero no válido'; END IF;
IF required>0 THEN RAISE EXCEPTION 'Este minero requiere verificación de hold on-chain; todavía no está activada'; END IF;
UPDATE public.dogg_players SET miner_id=next_id,shift_accrued=earned,rate_changed_at=stop_at WHERE telegram_id=p_telegram_id;
ELSIF p_action='start' THEN
IF p.shift_started_at IS NOT NULL THEN RAISE EXCEPTION 'Ya tienes un turno activo'; END IF;
UPDATE public.dogg_players SET shift_started_at=now(),rate_changed_at=now(),shift_accrued=0 WHERE telegram_id=p_telegram_id;
ELSIF p_action='claim' THEN
IF p.shift_started_at IS NULL OR now()<p.shift_started_at+interval '24 hours' THEN RAISE EXCEPTION 'El turno todavía no ha terminado'; END IF;
UPDATE public.dogg_players SET balance=balance+earned,claimed_shifts=claimed_shifts+1,shift_started_at=NULL,rate_changed_at=NULL,shift_accrued=0 WHERE telegram_id=p_telegram_id;
ELSIF p_action='checkin' THEN
IF p.last_checkin=current_date THEN RAISE EXCEPTION 'Ya reclamaste el bonus de hoy'; END IF;
UPDATE public.dogg_players SET streak=CASE WHEN last_checkin=current_date-1 THEN(streak%7)+1 ELSE 1 END,last_checkin=current_date,balance=balance+10 WHERE telegram_id=p_telegram_id;
END IF;
SELECT * INTO p FROM public.dogg_players WHERE telegram_id=p_telegram_id;
RETURN jsonb_build_object('balance',p.balance,'shiftStartedAt',p.shift_started_at,'claimedShifts',p.claimed_shifts,'streak',p.streak,'lastCheckin',p.last_checkin,'minerId',p.miner_id,'shiftAccrued',p.shift_accrued,'rateChangedAt',p.rate_changed_at);
END; $$;
REVOKE ALL ON FUNCTION public.dogg_shift(bigint,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dogg_shift(bigint,text) TO service_role;