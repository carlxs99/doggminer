CREATE TABLE public.dogg_ledger (
  id bigserial PRIMARY KEY,
  telegram_id bigint NOT NULL,
  kind text NOT NULL,
  label text NOT NULL,
  amount numeric NOT NULL,
  ref text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.dogg_ledger TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.dogg_ledger_id_seq TO service_role;
ALTER TABLE public.dogg_ledger ENABLE ROW LEVEL SECURITY;
CREATE INDEX dogg_ledger_player_time ON public.dogg_ledger (telegram_id, created_at DESC);
COMMENT ON TABLE public.dogg_ledger IS 'Every $DOGG balance movement per player (earnings, withdrawals, refunds), written by triggers; read only by verified server functions.';

-- Mining claims, referral claims and daily bonus: detected on the player row itself.
CREATE OR REPLACE FUNCTION public.dogg_ledger_players() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE delta numeric := NEW.balance - OLD.balance;
BEGIN
  IF delta = 0 THEN RETURN NEW; END IF;
  IF NEW.claimed_shifts > OLD.claimed_shifts THEN
    INSERT INTO dogg_ledger (telegram_id, kind, label, amount) VALUES (NEW.telegram_id, 'mining', 'hist.mining', delta);
  ELSIF OLD.ref_pending > 0 AND NEW.ref_pending = 0 AND delta > 0 THEN
    INSERT INTO dogg_ledger (telegram_id, kind, label, amount) VALUES (NEW.telegram_id, 'team', 'hist.ref', delta);
  ELSIF NEW.last_checkin IS DISTINCT FROM OLD.last_checkin AND delta > 0 THEN
    INSERT INTO dogg_ledger (telegram_id, kind, label, amount) VALUES (NEW.telegram_id, 'task', 'hist.checkin', delta);
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER dogg_ledger_players AFTER UPDATE OF balance ON public.dogg_players FOR EACH ROW EXECUTE FUNCTION public.dogg_ledger_players();

-- Ads paid by the Monetag postback.
CREATE OR REPLACE FUNCTION public.dogg_ledger_ads() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'paid' AND OLD.status IS DISTINCT FROM 'paid' THEN
    INSERT INTO dogg_ledger (telegram_id, kind, label, amount, ref, created_at) VALUES (NEW.telegram_id, 'task', 'hist.ad', 15, NEW.ymid::text, coalesce(NEW.paid_at, now()));
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER dogg_ledger_ads AFTER UPDATE OF status ON public.dogg_ad_views FOR EACH ROW EXECUTE FUNCTION public.dogg_ledger_ads();

-- Admin tasks claimed.
CREATE OR REPLACE FUNCTION public.dogg_ledger_tasks() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.claimed_at IS NOT NULL AND OLD.claimed_at IS NULL AND coalesce(NEW.reward, 0) <> 0 THEN
    INSERT INTO dogg_ledger (telegram_id, kind, label, amount, ref, created_at) VALUES (NEW.telegram_id, 'task', 'hist.task', NEW.reward, NEW.task_id::text, NEW.claimed_at);
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER dogg_ledger_tasks AFTER UPDATE OF claimed_at ON public.dogg_task_claims FOR EACH ROW EXECUTE FUNCTION public.dogg_ledger_tasks();

-- Withdrawals (amount + fee leave the balance) and refunds (they come back).
CREATE OR REPLACE FUNCTION public.dogg_ledger_withdrawals() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO dogg_ledger (telegram_id, kind, label, amount, ref, created_at) VALUES (NEW.telegram_id, 'withdraw', 'hist.withdraw', -(NEW.amount + NEW.fee), NEW.id::text, NEW.created_at);
  ELSIF NEW.status = 'failed' AND OLD.status IS DISTINCT FROM 'failed' THEN
    INSERT INTO dogg_ledger (telegram_id, kind, label, amount, ref) VALUES (NEW.telegram_id, 'withdraw', 'hist.refund', NEW.amount + NEW.fee, NEW.id::text);
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER dogg_ledger_withdrawals AFTER INSERT OR UPDATE OF status ON public.dogg_withdrawals FOR EACH ROW EXECUTE FUNCTION public.dogg_ledger_withdrawals();

-- Balance adjustments made from the admin panel.
CREATE OR REPLACE FUNCTION public.dogg_ledger_admin() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.action = 'adjust' AND (NEW.details->>'telegram_id') IS NOT NULL AND coalesce((NEW.details->>'delta')::numeric, 0) <> 0 THEN
    INSERT INTO dogg_ledger (telegram_id, kind, label, amount, created_at) VALUES ((NEW.details->>'telegram_id')::bigint, 'task', 'hist.admin', (NEW.details->>'delta')::numeric, NEW.created_at);
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER dogg_ledger_admin AFTER INSERT ON public.dogg_admin_log FOR EACH ROW EXECUTE FUNCTION public.dogg_ledger_admin();

REVOKE EXECUTE ON FUNCTION public.dogg_ledger_players(), public.dogg_ledger_ads(), public.dogg_ledger_tasks(), public.dogg_ledger_withdrawals(), public.dogg_ledger_admin() FROM PUBLIC, anon, authenticated;

-- Backfill what already has a timestamp: ads, tasks, withdrawals, refunds and admin adjustments.
INSERT INTO public.dogg_ledger (telegram_id, kind, label, amount, ref, created_at)
SELECT telegram_id, 'task', 'hist.ad', 15, ymid::text, coalesce(paid_at, created_at) FROM public.dogg_ad_views WHERE status = 'paid';
INSERT INTO public.dogg_ledger (telegram_id, kind, label, amount, ref, created_at)
SELECT telegram_id, 'task', 'hist.task', reward, task_id::text, claimed_at FROM public.dogg_task_claims WHERE claimed_at IS NOT NULL AND coalesce(reward, 0) <> 0;
INSERT INTO public.dogg_ledger (telegram_id, kind, label, amount, ref, created_at)
SELECT telegram_id, 'withdraw', 'hist.withdraw', -(amount + fee), id::text, created_at FROM public.dogg_withdrawals;
INSERT INTO public.dogg_ledger (telegram_id, kind, label, amount, ref, created_at)
SELECT telegram_id, 'withdraw', 'hist.refund', amount + fee, id::text, coalesce(attempted_at, created_at) FROM public.dogg_withdrawals WHERE status = 'failed';
INSERT INTO public.dogg_ledger (telegram_id, kind, label, amount, created_at)
SELECT (details->>'telegram_id')::bigint, 'task', 'hist.admin', (details->>'delta')::numeric, created_at FROM public.dogg_admin_log
WHERE action = 'adjust' AND (details->>'telegram_id') IS NOT NULL AND coalesce((details->>'delta')::numeric, 0) <> 0;