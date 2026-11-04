ALTER TABLE public.dogg_players
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminders_off boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bot_blocked_at timestamptz;

-- Claims the next batch of players due today's reminder; stamps them first so each player gets at most one per day.
CREATE OR REPLACE FUNCTION public.dogg_claim_reminders(p_limit integer)
RETURNS SETOF public.dogg_players
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.dogg_players p SET reminder_sent_at = now()
  WHERE p.telegram_id IN (
    SELECT telegram_id FROM public.dogg_players
    WHERE NOT reminders_off AND bot_blocked_at IS NULL
      AND (reminder_sent_at IS NULL OR reminder_sent_at < now() - interval '20 hours')
    ORDER BY telegram_id
    LIMIT greatest(1, least(p_limit, 500))
    FOR UPDATE SKIP LOCKED
  )
  RETURNING p.*;
$$;

REVOKE ALL ON FUNCTION public.dogg_claim_reminders(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dogg_claim_reminders(integer) TO service_role;