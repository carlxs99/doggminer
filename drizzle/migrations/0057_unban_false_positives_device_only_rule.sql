CREATE TABLE IF NOT EXISTS public.dogg_unban_apologies (
  telegram_id bigint PRIMARY KEY,
  unbanned_at timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz
);
GRANT ALL ON public.dogg_unban_apologies TO service_role;
ALTER TABLE public.dogg_unban_apologies ENABLE ROW LEVEL SECURITY;

INSERT INTO public.dogg_unban_apologies (telegram_id)
SELECT p.telegram_id FROM public.dogg_players p
WHERE p.banned_at IS NOT NULL AND p.ban_reason = 'multi_device'
  AND NOT EXISTS (
    SELECT 1 FROM public.dogg_signals s1
    JOIN public.dogg_signals s2 ON s1.kind = 'device' AND s2.kind = 'device' AND s1.value = s2.value AND s2.telegram_id <> s1.telegram_id
    WHERE s1.telegram_id = p.telegram_id)
  AND (SELECT count(*) FROM public.dogg_players r WHERE r.referred_by = p.telegram_id) < 5
  AND (p.claimed_shifts > 0 OR p.balance > 0 OR p.last_hold > 0 OR p.wallet_address IS NOT NULL)
ON CONFLICT DO NOTHING;

UPDATE public.dogg_players p SET banned_at = NULL, ban_reason = NULL, ban_exempt = true
FROM public.dogg_unban_apologies u WHERE u.telegram_id = p.telegram_id AND p.banned_at IS NOT NULL;

-- Auto-ban now requires a shared device id (the random id stored on the phone).
-- Shared network (mobile carriers put hundreds of people behind one IP) and phone fingerprint
-- (same popular model = same hash) are NOT proof: those cases go to manual review in the admin panel.
-- Bot floods are handled by the referral speed signature in dogg_register.
CREATE OR REPLACE FUNCTION public.dogg_auto_ban(p_telegram_id bigint)
 RETURNS bigint[] LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE newly bigint[] := '{}'; c record;
BEGIN
  FOR c IN
    SELECT array_agg(DISTINCT p.telegram_id) AS ids, bool_or(p.banned_at IS NOT NULL) AS has_banned
    FROM dogg_signals me
      JOIN dogg_signals d ON d.kind = 'device' AND d.value = me.value
      JOIN dogg_players p ON p.telegram_id = d.telegram_id
      WHERE me.telegram_id = p_telegram_id AND me.kind = 'device'
        AND NOT p.ban_exempt AND p.telegram_id NOT IN (SELECT telegram_id FROM dogg_admins)
      GROUP BY me.value
  LOOP
    IF coalesce(array_length(c.ids, 1), 0) > 5 OR (c.has_banned AND array_length(c.ids, 1) > 1) THEN
      newly := newly || dogg_ban_group(c.ids);
    END IF;
  END LOOP;
  RETURN newly;
END; $function$;