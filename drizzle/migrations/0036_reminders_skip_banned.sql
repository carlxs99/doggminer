CREATE OR REPLACE FUNCTION public.dogg_claim_reminders(p_limit integer)
 RETURNS SETOF dogg_players
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  UPDATE public.dogg_players p SET reminder_sent_at = now()
  WHERE p.telegram_id IN (
    SELECT telegram_id FROM public.dogg_players
    WHERE NOT reminders_off AND bot_blocked_at IS NULL AND banned_at IS NULL
      AND (reminder_sent_at IS NULL OR reminder_sent_at < now() - interval '20 hours')
    ORDER BY telegram_id
    LIMIT greatest(1, least(p_limit, 500))
    FOR UPDATE SKIP LOCKED
  )
  RETURNING p.*;
$function$;