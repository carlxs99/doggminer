ALTER TABLE public.dogg_withdrawals
  ADD COLUMN IF NOT EXISTS query_id text,
  ADD COLUMN IF NOT EXISTS tx_hash text,
  ADD COLUMN IF NOT EXISTS attempted_at timestamptz,
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS dogg_withdrawals_status_idx ON public.dogg_withdrawals (status, created_at);

-- Longer lock: one payout run (reconcile + a few sends with on-chain confirmation) fits inside it.
CREATE OR REPLACE FUNCTION public.dogg_payout_acquire()
 RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH u AS (UPDATE public.dogg_payout_lock SET locked_until = now() + interval '120 seconds' WHERE id=1 AND locked_until < now() RETURNING 1)
  SELECT EXISTS (SELECT 1 FROM u);
$function$;
REVOKE ALL ON FUNCTION public.dogg_payout_acquire() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dogg_payout_acquire() TO service_role;