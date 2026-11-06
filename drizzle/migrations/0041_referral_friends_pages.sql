-- The friends list is paginated: the server hands back one page of recruits at a time
-- (REF_PAGE in src/lib/dogg.ts) instead of a fixed recent window, so players with
-- hundreds of recruits can walk through all of them with a 1/N page indicator.
DROP FUNCTION IF EXISTS public.dogg_referral(bigint, text);

CREATE OR REPLACE FUNCTION public.dogg_referral(p_telegram_id bigint, p_action text, p_page integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE p public.dogg_players; claimed numeric := 0; total integer; qualified integer; friends jsonb; page integer;
BEGIN
  IF p_action NOT IN ('read', 'claim') THEN RAISE EXCEPTION 'Invalid action'; END IF;
  page := coalesce(p_page, 0);
  IF page < 0 THEN page := 0; END IF;
  IF page > 500 THEN page := 500; END IF;
  INSERT INTO public.dogg_players (telegram_id) VALUES (p_telegram_id) ON CONFLICT DO NOTHING;
  SELECT * INTO p FROM public.dogg_players WHERE telegram_id = p_telegram_id FOR UPDATE;
  IF p_action = 'claim' THEN
    IF p.ref_pending <= 0 THEN RAISE EXCEPTION 'No tienes recompensas de referidos por reclamar.'; END IF;
    claimed := p.ref_pending;
    UPDATE public.dogg_players SET balance = balance + ref_pending, ref_pending = 0 WHERE telegram_id = p_telegram_id;
    SELECT * INTO p FROM public.dogg_players WHERE telegram_id = p_telegram_id;
  END IF;
  SELECT count(*), count(referral_qualified_at) INTO total, qualified FROM public.dogg_players WHERE referred_by = p_telegram_id;
  SELECT coalesce(jsonb_agg(jsonb_build_object('name', coalesce(f.first_name, f.username, 'Homie'), 'username', f.username, 'joinedAt', f.created_at, 'qualified', f.referral_qualified_at IS NOT NULL, 'given', f.ref_given) ORDER BY f.created_at DESC), '[]'::jsonb)
    INTO friends FROM (SELECT * FROM public.dogg_players WHERE referred_by = p_telegram_id ORDER BY created_at DESC LIMIT 20 OFFSET page * 20) f;
  RETURN jsonb_build_object('total', total, 'qualified', qualified, 'pending', p.ref_pending, 'earned', p.ref_earned, 'balance', p.balance, 'claimed', claimed, 'walletLinked', p.wallet_address IS NOT NULL, 'page', page, 'pages', greatest(1, ceil(total::numeric / 20)), 'friends', friends);
END; $function$;

REVOKE ALL ON FUNCTION public.dogg_referral(bigint, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dogg_referral(bigint, text, integer) TO service_role;