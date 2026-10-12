CREATE TABLE public.dogg_players (telegram_id bigint PRIMARY KEY, balance numeric NOT NULL DEFAULT 0, shift_started_at timestamptz, claimed_shifts integer NOT NULL DEFAULT 0, last_checkin date, streak integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.dogg_players TO service_role;
ALTER TABLE public.dogg_players ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.dogg_players IS 'Telegram identity verified server-side; no browser Data API access. Balances are game credits, not on-chain jetton transfers.';
CREATE OR REPLACE FUNCTION public.dogg_shift(p_telegram_id bigint, p_action text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.dogg_players; reward numeric;
BEGIN
IF p_action NOT IN ('read','start','claim','checkin') THEN RAISE EXCEPTION 'Invalid action'; END IF;
INSERT INTO public.dogg_players(telegram_id) VALUES(p_telegram_id) ON CONFLICT DO NOTHING;
SELECT * INTO p FROM public.dogg_players WHERE telegram_id=p_telegram_id FOR UPDATE;
IF p_action='start' THEN
IF p.shift_started_at IS NOT NULL THEN RAISE EXCEPTION 'Ya tienes un turno activo'; END IF;
UPDATE public.dogg_players SET shift_started_at=now() WHERE telegram_id=p_telegram_id;
ELSIF p_action='claim' THEN
IF p.shift_started_at IS NULL OR now()<p.shift_started_at+interval '24 hours' THEN RAISE EXCEPTION 'El turno todavía no ha terminado'; END IF;
reward:=86.4;
UPDATE public.dogg_players SET balance=balance+reward, claimed_shifts=claimed_shifts+1, shift_started_at=NULL WHERE telegram_id=p_telegram_id;
ELSIF p_action='checkin' THEN
IF p.last_checkin=current_date THEN RAISE EXCEPTION 'Ya reclamaste el bonus de hoy'; END IF;
UPDATE public.dogg_players SET streak=CASE WHEN last_checkin=current_date-1 THEN (streak%7)+1 ELSE 1 END, last_checkin=current_date, balance=balance+10 WHERE telegram_id=p_telegram_id;
END IF;
SELECT * INTO p FROM public.dogg_players WHERE telegram_id=p_telegram_id;
RETURN jsonb_build_object('balance',p.balance,'shiftStartedAt',p.shift_started_at,'claimedShifts',p.claimed_shifts,'streak',p.streak,'lastCheckin',p.last_checkin);
END; $$;
REVOKE ALL ON FUNCTION public.dogg_shift(bigint,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dogg_shift(bigint,text) TO service_role;