CREATE TABLE public.dogg_ad_views (
  ymid uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  event_type text,
  reward_event_type text,
  estimated_price numeric,
  postbacks integer NOT NULL DEFAULT 0
);
GRANT ALL ON public.dogg_ad_views TO service_role;
ALTER TABLE public.dogg_ad_views ENABLE ROW LEVEL SECURITY;
CREATE INDEX dogg_ad_views_player_idx ON public.dogg_ad_views (telegram_id, created_at DESC);

DROP FUNCTION IF EXISTS public.dogg_ad(bigint, text);

-- Player side: open an ad view (returns its ymid) and read its status. Paying happens only in dogg_ad_postback.
CREATE OR REPLACE FUNCTION public.dogg_ad(p_telegram_id bigint, p_action text, p_ymid uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE p public.dogg_players; today date := (now() AT TIME ZONE 'utc')::date; cnt integer; v public.dogg_ad_views; new_ymid uuid; opened integer;
BEGIN
  IF p_action NOT IN ('read','start','status') THEN RAISE EXCEPTION 'Invalid action'; END IF;
  INSERT INTO public.dogg_players(telegram_id) VALUES (p_telegram_id) ON CONFLICT DO NOTHING;
  SELECT * INTO p FROM public.dogg_players WHERE telegram_id = p_telegram_id FOR UPDATE;
  cnt := CASE WHEN p.ad_day = today THEN p.ad_count ELSE 0 END;
  IF p_action = 'start' THEN
    IF cnt >= 10 THEN RAISE EXCEPTION 'Ya viste los 10 anuncios de hoy. Vuelve mañana.'; END IF;
    SELECT count(*) INTO opened FROM public.dogg_ad_views WHERE telegram_id = p_telegram_id AND created_at > now() - interval '24 hours';
    IF opened >= 40 THEN RAISE EXCEPTION 'Demasiados intentos de anuncio hoy. Vuelve mañana.'; END IF;
    INSERT INTO public.dogg_ad_views(telegram_id) VALUES (p_telegram_id) RETURNING ymid INTO new_ymid;
    RETURN jsonb_build_object('adsToday', cnt, 'balance', p.balance, 'ymid', new_ymid, 'status', 'pending');
  ELSIF p_action = 'status' THEN
    SELECT * INTO v FROM public.dogg_ad_views WHERE ymid = p_ymid AND telegram_id = p_telegram_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Anuncio no encontrado.'; END IF;
    RETURN jsonb_build_object('adsToday', cnt, 'balance', p.balance, 'ymid', v.ymid, 'status', v.status);
  END IF;
  RETURN jsonb_build_object('adsToday', cnt, 'balance', p.balance);
END; $$;

-- Monetag side: called only by the secret-checked postback route. Pays +15 once per ymid, only for valued events, within the daily cap.
CREATE OR REPLACE FUNCTION public.dogg_ad_postback(p_ymid uuid, p_event text, p_reward text, p_price numeric, p_telegram_id bigint)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v public.dogg_ad_views; p public.dogg_players; today date := (now() AT TIME ZONE 'utc')::date; cnt integer;
BEGIN
  SELECT * INTO v FROM public.dogg_ad_views WHERE ymid = p_ymid FOR UPDATE;
  IF NOT FOUND THEN RETURN 'unknown'; END IF;
  UPDATE public.dogg_ad_views SET postbacks = postbacks + 1, event_type = coalesce(p_event, event_type),
    reward_event_type = CASE WHEN status = 'paid' THEN reward_event_type ELSE coalesce(p_reward, reward_event_type) END,
    estimated_price = coalesce(p_price, estimated_price) WHERE ymid = p_ymid;
  IF v.status <> 'pending' THEN RETURN 'duplicate'; END IF;
  IF p_telegram_id IS NOT NULL AND p_telegram_id <> v.telegram_id THEN
    UPDATE public.dogg_ad_views SET status = 'mismatch' WHERE ymid = p_ymid; RETURN 'mismatch';
  END IF;
  IF p_reward IS DISTINCT FROM 'valued' THEN RETURN 'not_valued'; END IF;
  IF now() > v.created_at + interval '48 hours' THEN
    UPDATE public.dogg_ad_views SET status = 'expired' WHERE ymid = p_ymid; RETURN 'expired';
  END IF;
  SELECT * INTO p FROM public.dogg_players WHERE telegram_id = v.telegram_id FOR UPDATE;
  cnt := CASE WHEN p.ad_day = today THEN p.ad_count ELSE 0 END;
  IF cnt >= 10 THEN
    UPDATE public.dogg_ad_views SET status = 'capped' WHERE ymid = p_ymid; RETURN 'capped';
  END IF;
  UPDATE public.dogg_players SET balance = balance + 15, ad_day = today, ad_count = cnt + 1 WHERE telegram_id = v.telegram_id;
  UPDATE public.dogg_ad_views SET status = 'paid', paid_at = now() WHERE ymid = p_ymid;
  RETURN 'paid';
END; $$;

REVOKE ALL ON FUNCTION public.dogg_ad(bigint, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dogg_ad_postback(uuid, text, text, numeric, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dogg_ad(bigint, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.dogg_ad_postback(uuid, text, text, numeric, bigint) TO service_role;