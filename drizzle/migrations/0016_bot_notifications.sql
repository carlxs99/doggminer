ALTER TABLE public.dogg_players ADD COLUMN IF NOT EXISTS ref_join_notified_at timestamptz;
ALTER TABLE public.dogg_players ADD COLUMN IF NOT EXISTS ref_qualified_notified_at timestamptz;
ALTER TABLE public.dogg_withdrawals ADD COLUMN IF NOT EXISTS notified_at timestamptz;
-- Existing referrals and finished withdrawals count as already notified, so nobody gets old news.
UPDATE public.dogg_players SET ref_join_notified_at = created_at WHERE referred_by IS NOT NULL AND ref_join_notified_at IS NULL;
UPDATE public.dogg_players SET ref_qualified_notified_at = referral_qualified_at WHERE referral_qualified_at IS NOT NULL AND ref_qualified_notified_at IS NULL;
UPDATE public.dogg_withdrawals SET notified_at = now() WHERE status IN ('sent','failed') AND notified_at IS NULL;