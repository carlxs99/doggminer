CREATE OR REPLACE FUNCTION public.dogg_ad(p_telegram_id bigint, p_action text, p_ymid uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE p public.dogg_players; today date := (now() AT TIME ZONE 'utc')::date; cnt integer; v public.dogg_ad_views; new_ymid uuid; opened integer;
BEGIN
  IF p_action NOT IN ('read','start','status','claim') THEN RAISE EXCEPTION 'Invalid action'; END IF;
  INSERT INTO public.dogg_players(telegram_id) VALUES (p_telegram_id) ON CONFLICT DO NOTHING;
  SELECT * INTO p FROM public.dogg_players WHERE telegram_id = p_telegram_id FOR UPDATE;
  cnt := CASE WHEN p.ad_day = today THEN p.ad_count ELSE 0 END;
  IF p_action = 'start' THEN
    IF cnt >= 10 THEN RAISE EXCEPTION 'Ya viste los 10 anuncios de hoy. Vuelve mañana.'; END IF;
    SELECT count(*) INTO opened FROM public.dogg_ad_views WHERE telegram_id = p_telegram_id AND created_at > now() - interval '24 hours';
    IF opened >= 40 THEN RAISE EXCEPTION 'Demasiados intentos de anuncio hoy. Vuelve mañana.'; END IF;
    INSERT INTO public.dogg_ad_views(telegram_id) VALUES (p_telegram_id) RETURNING ymid INTO new_ymid;
    RETURN jsonb_build_object('adsToday', cnt, 'balance', p.balance, 'ymid', new_ymid, 'status', 'pending');
  ELSIF p_action IN ('status','claim') THEN
    SELECT * INTO v FROM public.dogg_ad_views WHERE ymid = p_ymid AND telegram_id = p_telegram_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Anuncio no encontrado.'; END IF;
    IF p_action = 'claim' AND v.status IN ('pending','not_valued') THEN
      IF cnt >= 10 THEN
        UPDATE public.dogg_ad_views SET status = 'capped' WHERE ymid = p_ymid;
        RETURN jsonb_build_object('adsToday', cnt, 'balance', p.balance, 'ymid', v.ymid, 'status', 'capped');
      END IF;
      IF now() < v.created_at + interval '3 seconds' THEN RAISE EXCEPTION 'Mira el anuncio completo para recibir tu recompensa.'; END IF;
      cnt := cnt + 1;
      UPDATE public.dogg_players SET balance = balance + 5, ad_day = today, ad_count = cnt WHERE telegram_id = p_telegram_id RETURNING * INTO p;
      UPDATE public.dogg_ad_views SET status = 'paid', paid_at = now() WHERE ymid = p_ymid;
      RETURN jsonb_build_object('adsToday', cnt, 'balance', p.balance, 'ymid', v.ymid, 'status', 'paid');
    END IF;
    RETURN jsonb_build_object('adsToday', cnt, 'balance', p.balance, 'ymid', v.ymid, 'status', v.status);
  END IF;
  RETURN jsonb_build_object('adsToday', cnt, 'balance', p.balance);
END; $function$;

CREATE OR REPLACE FUNCTION public.dogg_ad_postback(p_ymid uuid, p_event text, p_reward text, p_price numeric, p_telegram_id bigint)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v public.dogg_ad_views; p public.dogg_players; today date := (now() AT TIME ZONE 'utc')::date; cnt integer;
BEGIN
  SELECT * INTO v FROM public.dogg_ad_views WHERE ymid = p_ymid FOR UPDATE;
  IF NOT FOUND THEN RETURN 'unknown'; END IF;
  UPDATE public.dogg_ad_views SET postbacks = postbacks + 1, event_type = coalesce(p_event, event_type),
    reward_event_type = CASE WHEN status = 'paid' THEN reward_event_type ELSE coalesce(p_reward, reward_event_type) END,
    estimated_price = coalesce(p_price, estimated_price) WHERE ymid = p_ymid;
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
  UPDATE public.dogg_players SET balance = balance + 5, ad_day = today, ad_count = cnt + 1 WHERE telegram_id = v.telegram_id;
  UPDATE public.dogg_ad_views SET status = 'paid', paid_at = now() WHERE ymid = p_ymid;
  RETURN 'paid';
END; $function$;

CREATE OR REPLACE FUNCTION public.dogg_ledger_ads()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'paid' AND OLD.status IS DISTINCT FROM 'paid' THEN
    INSERT INTO dogg_ledger (telegram_id, kind, label, amount, ref, created_at) VALUES (NEW.telegram_id, 'task', 'hist.ad', 5, NEW.ymid::text, coalesce(NEW.paid_at, now()));
  END IF;
  RETURN NEW;
END; $function$;