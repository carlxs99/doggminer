ALTER TABLE public.dogg_players
  ADD COLUMN IF NOT EXISTS ad_day date,
  ADD COLUMN IF NOT EXISTS ad_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ad_started_at timestamptz;

-- Rewarded ads: 'start' opens one ad session; 'claim' pays +15 only for an open session at least 5s old (max 15 min), 10 per UTC day.
CREATE OR REPLACE FUNCTION public.dogg_ad(p_telegram_id bigint, p_action text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE p public.dogg_players; today date := (now() AT TIME ZONE 'utc')::date; cnt integer;
BEGIN
  IF p_action NOT IN ('read','start','claim') THEN RAISE EXCEPTION 'Invalid action'; END IF;
  INSERT INTO public.dogg_players(telegram_id) VALUES (p_telegram_id) ON CONFLICT DO NOTHING;
  SELECT * INTO p FROM public.dogg_players WHERE telegram_id = p_telegram_id FOR UPDATE;
  cnt := CASE WHEN p.ad_day = today THEN p.ad_count ELSE 0 END;
  IF p_action = 'start' THEN
    IF cnt >= 10 THEN RAISE EXCEPTION 'Ya viste los 10 anuncios de hoy. Vuelve mañana.'; END IF;
    UPDATE public.dogg_players SET ad_started_at = now() WHERE telegram_id = p_telegram_id;
  ELSIF p_action = 'claim' THEN
    IF cnt >= 10 THEN RAISE EXCEPTION 'Ya viste los 10 anuncios de hoy. Vuelve mañana.'; END IF;
    IF p.ad_started_at IS NULL OR now() > p.ad_started_at + interval '15 minutes' THEN RAISE EXCEPTION 'No hay un anuncio activo. Pulsa de nuevo «Ver anuncio».'; END IF;
    IF now() < p.ad_started_at + interval '5 seconds' THEN RAISE EXCEPTION 'Mira el anuncio completo para recibir tu recompensa.'; END IF;
    cnt := cnt + 1;
    UPDATE public.dogg_players SET balance = balance + 15, ad_day = today, ad_count = cnt, ad_started_at = NULL WHERE telegram_id = p_telegram_id;
  END IF;
  SELECT * INTO p FROM public.dogg_players WHERE telegram_id = p_telegram_id;
  RETURN jsonb_build_object('adsToday', cnt, 'balance', p.balance);
END; $$;

REVOKE ALL ON FUNCTION public.dogg_ad(bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dogg_ad(bigint, text) TO service_role;