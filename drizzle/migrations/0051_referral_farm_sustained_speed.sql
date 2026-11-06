CREATE OR REPLACE FUNCTION public.dogg_register(p_telegram_id bigint, p_referrer bigint, p_first_name text, p_username text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE recent int; heavy_secs int; heavy_joins int;
BEGIN
  INSERT INTO public.dogg_players (telegram_id, first_name, username) VALUES (p_telegram_id, left(p_first_name, 64), left(p_username, 64))
  ON CONFLICT (telegram_id) DO UPDATE SET first_name = excluded.first_name, username = excluded.username;
  IF p_referrer IS NOT NULL AND p_referrer <> p_telegram_id THEN
    UPDATE public.dogg_players me SET referred_by = p_referrer
    WHERE me.telegram_id = p_telegram_id AND me.referred_by IS NULL AND me.claimed_shifts = 0
      AND me.created_at > now() - interval '1 hour'
      AND EXISTS (SELECT 1 FROM public.dogg_players r WHERE r.telegram_id = p_referrer AND r.created_at < me.created_at);
    IF FOUND THEN
      -- Farm signature = volume AND sustained machine speed. A viral channel post produces random
      -- human spikes (some seconds with 8-13 joins) but most joins still arrive spread out; scripts
      -- push nearly all their joins through seconds with 8+ registrations. Ban only when >30 joins in
      -- 10 min, at least 5 seconds with 8+ joins, and those seconds carry >=60% of all joins.
      -- Anything less is left to manual review in the admin panel.
      SELECT count(*) INTO recent FROM public.dogg_players
        WHERE referred_by = p_referrer AND created_at > now() - interval '10 minutes';
      IF recent > 30 THEN
        SELECT count(*), coalesce(sum(c), 0) INTO heavy_secs, heavy_joins FROM (
          SELECT count(*) c FROM public.dogg_players
          WHERE referred_by = p_referrer AND created_at > now() - interval '10 minutes'
          GROUP BY date_trunc('second', created_at) HAVING count(*) >= 8) s;
        IF heavy_secs >= 5 AND heavy_joins >= 0.6 * recent AND EXISTS (SELECT 1 FROM public.dogg_players WHERE telegram_id = p_referrer
              AND banned_at IS NULL AND NOT ban_exempt) AND p_referrer NOT IN (SELECT telegram_id FROM public.dogg_admins) THEN
          UPDATE public.dogg_players SET ref_pending = 0 WHERE telegram_id = p_referrer;
          PERFORM public.dogg_ban_group(ARRAY[p_referrer]);
          UPDATE public.dogg_players SET ban_reason = 'referral_farm' WHERE telegram_id = p_referrer AND banned_at IS NOT NULL;
        END IF;
      END IF;
      PERFORM public.dogg_referral_qualify(p_telegram_id);
    END IF;
  END IF;
END; $function$;