ALTER TABLE public.dogg_withdrawals ADD COLUMN channel_notified_at timestamptz;
-- Withdrawals finished before the payouts channel existed are not announced retroactively.
UPDATE public.dogg_withdrawals SET channel_notified_at = now() WHERE status IN ('sent', 'failed');