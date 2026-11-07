DO $$ DECLARE src text; BEGIN
  SELECT pg_get_functiondef('public.dogg_register(bigint,bigint,text,text)'::regprocedure) INTO src;
  src := replace(src, 'DECLARE recent int; heavy_secs int; heavy_joins int;',
    'DECLARE recent int; heavy_secs int; heavy_joins int; r30 int; bot30 int;');
  src := replace(src, '      PERFORM public.dogg_referral_qualify(p_telegram_id);',
'      -- Paced farms (4-5 joins/sec) dodge the burst rule. Second signature: >=40 recruits in 30 min
      -- and >=90% of them started mining under 8 s after registering; humans read the app first.
      SELECT count(*), count(*) FILTER (WHERE shift_started_at IS NOT NULL
               AND shift_started_at - created_at < interval ''8 seconds'')
        INTO r30, bot30 FROM public.dogg_players
        WHERE referred_by = p_referrer AND created_at > now() - interval ''30 minutes'';
      IF r30 >= 40 AND bot30 >= 0.9 * r30 AND EXISTS (SELECT 1 FROM public.dogg_players WHERE telegram_id = p_referrer
            AND banned_at IS NULL AND NOT ban_exempt) AND p_referrer NOT IN (SELECT telegram_id FROM public.dogg_admins) THEN
        UPDATE public.dogg_players SET ref_pending = 0 WHERE telegram_id = p_referrer;
        PERFORM public.dogg_ban_group(ARRAY[p_referrer]);
        UPDATE public.dogg_players SET ban_reason = ''referral_farm'' WHERE telegram_id = p_referrer AND banned_at IS NOT NULL;
      END IF;
      PERFORM public.dogg_referral_qualify(p_telegram_id);');
  EXECUTE src;
END $$;