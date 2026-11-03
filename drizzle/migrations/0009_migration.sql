CREATE OR REPLACE FUNCTION public.dogg_ad_postback(p_ymid uuid, p_event text, p_reward text, p_price numeric, p_telegram_id bigint)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v public.dogg_ad_views; p public.dogg_players; today date := (now() AT TIME ZONE 'utc')::date; cnt integer;
BEGIN
  SELECT * INTO v FROM public.dogg_ad_views WHERE ymid = p_ymid FOR UPDATE;
  IF NOT FOUND THEN RETURN 'unknown'; END IF;
  UPDATE public.dogg_ad_views SET postbacks = postbacks + 1, event_type = coalesce(p_event, event_type),
    reward_event_type = CASE WHEN status = 'paid' THEN reward_event_type ELSE coalesce(p_reward, reward_event_type) END,
    estimated_price = coalesce(p_price, estimated_price) WHERE ymid = p_ymid;
  -- A non-valued event can still be followed by a valued one for the same ymid (e.g. a click), so it stays payable.
  IF v.status NOT IN ('pending', 'not_valued') THEN RETURN 'duplicate'; END IF;
  IF p_telegram_id IS NOT NULL AND p_telegram_id <> v.telegram_id THEN
    UPDATE public.dogg_ad_views SET status = 'mismatch' WHERE ymid = p_ymid; RETURN 'mismatch';
  END IF;
  IF p_reward IS DISTINCT FROM 'valued' THEN
    UPDATE public.dogg_ad_views SET status = 'not_valued' WHERE ymid = p_ymid; RETURN 'not_valued';
  END IF;
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
REVOKE ALL ON FUNCTION public.dogg_ad_postback(uuid, text, text, numeric, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dogg_ad_postback(uuid, text, text, numeric, bigint) TO service_role;