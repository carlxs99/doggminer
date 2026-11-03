-- Admins are Telegram accounts, kept in their own table (never a flag on the player row).
CREATE TABLE public.dogg_admins (
  telegram_id bigint PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.dogg_admins TO service_role;
ALTER TABLE public.dogg_admins ENABLE ROW LEVEL SECURITY;

-- Tasks created by the admin: join a channel / group (verified by the bot) or open a bot (10 s wait).
CREATE TABLE public.dogg_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('channel', 'group', 'bot')),
  title text NOT NULL,
  description text,
  url text NOT NULL,
  chat_id text,
  reward numeric NOT NULL CHECK (reward > 0 AND reward <= 100000),
  active boolean NOT NULL DEFAULT true,
  sort integer NOT NULL DEFAULT 0,
  claims integer NOT NULL DEFAULT 0,
  created_by bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.dogg_tasks TO service_role;
ALTER TABLE public.dogg_tasks ENABLE ROW LEVEL SECURITY;
CREATE INDEX dogg_tasks_active_idx ON public.dogg_tasks (active, sort, created_at DESC);

CREATE TABLE public.dogg_task_claims (
  task_id uuid NOT NULL REFERENCES public.dogg_tasks(id) ON DELETE CASCADE,
  telegram_id bigint NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  reward numeric,
  PRIMARY KEY (task_id, telegram_id)
);
GRANT ALL ON public.dogg_task_claims TO service_role;
ALTER TABLE public.dogg_task_claims ENABLE ROW LEVEL SECURITY;
CREATE INDEX dogg_task_claims_player_idx ON public.dogg_task_claims (telegram_id);

-- Every admin action is written down.
CREATE TABLE public.dogg_admin_log (
  id bigserial PRIMARY KEY,
  admin_id bigint NOT NULL,
  action text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.dogg_admin_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.dogg_admin_log_id_seq TO service_role;
ALTER TABLE public.dogg_admin_log ENABLE ROW LEVEL SECURITY;

-- Player opens a task: remember when (the bot-task 10 s wait counts from here, server time).
CREATE OR REPLACE FUNCTION public.dogg_task_start(p_telegram_id bigint, p_task uuid)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE t public.dogg_tasks; started timestamptz;
BEGIN
  SELECT * INTO t FROM public.dogg_tasks WHERE id = p_task AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Esta tarea ya no está disponible.'; END IF;
  INSERT INTO public.dogg_players (telegram_id) VALUES (p_telegram_id) ON CONFLICT DO NOTHING;
  INSERT INTO public.dogg_task_claims (task_id, telegram_id) VALUES (p_task, p_telegram_id) ON CONFLICT DO NOTHING;
  SELECT started_at INTO started FROM public.dogg_task_claims WHERE task_id = p_task AND telegram_id = p_telegram_id;
  RETURN started;
END; $$;

-- Pays a task once. Channel/group membership is checked by the server with the bot before calling (p_member).
CREATE OR REPLACE FUNCTION public.dogg_task_claim(p_telegram_id bigint, p_task uuid, p_member boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE t public.dogg_tasks; c public.dogg_task_claims; bal numeric;
BEGIN
  SELECT * INTO t FROM public.dogg_tasks WHERE id = p_task AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Esta tarea ya no está disponible.'; END IF;
  SELECT * INTO c FROM public.dogg_task_claims WHERE task_id = p_task AND telegram_id = p_telegram_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Primero abre la tarea.'; END IF;
  IF c.claimed_at IS NOT NULL THEN RAISE EXCEPTION 'Ya cobraste esta tarea.'; END IF;
  IF t.kind = 'bot' AND now() < c.started_at + interval '10 seconds' THEN RAISE EXCEPTION 'Espera 10 segundos con el bot abierto antes de reclamar.'; END IF;
  IF t.kind IN ('channel', 'group') AND NOT coalesce(p_member, false) THEN RAISE EXCEPTION 'Aún no te vemos dentro. Únete y vuelve a verificar.'; END IF;
  UPDATE public.dogg_task_claims SET claimed_at = now(), reward = t.reward WHERE task_id = p_task AND telegram_id = p_telegram_id;
  UPDATE public.dogg_tasks SET claims = claims + 1 WHERE id = p_task;
  UPDATE public.dogg_players SET balance = balance + t.reward WHERE telegram_id = p_telegram_id RETURNING balance INTO bal;
  RETURN jsonb_build_object('balance', bal, 'reward', t.reward);
END; $$;

-- Admin: add or remove $DOGG from a player's app balance, logged.
CREATE OR REPLACE FUNCTION public.dogg_admin_adjust(p_admin bigint, p_telegram_id bigint, p_delta numeric, p_reason text)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE bal numeric;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.dogg_admins WHERE telegram_id = p_admin) THEN RAISE EXCEPTION 'No autorizado'; END IF;
  SELECT balance INTO bal FROM public.dogg_players WHERE telegram_id = p_telegram_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Usuario no encontrado'; END IF;
  IF bal + p_delta < 0 THEN RAISE EXCEPTION 'El saldo no puede quedar negativo (tiene %).', round(bal, 3); END IF;
  UPDATE public.dogg_players SET balance = balance + p_delta WHERE telegram_id = p_telegram_id RETURNING balance INTO bal;
  INSERT INTO public.dogg_admin_log (admin_id, action, details) VALUES (p_admin, 'adjust', jsonb_build_object('telegram_id', p_telegram_id, 'delta', p_delta, 'reason', left(p_reason, 200), 'balance', bal));
  RETURN bal;
END; $$;

-- Admin dashboard numbers in one call.
CREATE OR REPLACE FUNCTION public.dogg_admin_stats()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT jsonb_build_object(
    'users', (SELECT count(*) FROM public.dogg_players),
    'new24h', (SELECT count(*) FROM public.dogg_players WHERE created_at > now() - interval '24 hours'),
    'new7d', (SELECT count(*) FROM public.dogg_players WHERE created_at > now() - interval '7 days'),
    'mining', (SELECT count(*) FROM public.dogg_players WHERE shift_started_at IS NOT NULL),
    'wallets', (SELECT count(*) FROM public.dogg_players WHERE wallet_address IS NOT NULL),
    'verifiedWithdraw', (SELECT count(*) FROM public.dogg_players WHERE withdraw_verified_at IS NOT NULL),
    'appBalance', (SELECT coalesce(sum(balance), 0) FROM public.dogg_players),
    'refPending', (SELECT coalesce(sum(ref_pending), 0) FROM public.dogg_players),
    'referred', (SELECT count(*) FROM public.dogg_players WHERE referred_by IS NOT NULL),
    'adsToday', (SELECT count(*) FROM public.dogg_ad_views WHERE status = 'paid' AND paid_at > date_trunc('day', now())),
    'tasksPaid', (SELECT count(*) FROM public.dogg_task_claims WHERE claimed_at IS NOT NULL),
    'tasksPaid24h', (SELECT coalesce(sum(reward), 0) FROM public.dogg_task_claims WHERE claimed_at > now() - interval '24 hours'),
    'wdPending', (SELECT count(*) FROM public.dogg_withdrawals WHERE status = 'pending'),
    'wdSending', (SELECT count(*) FROM public.dogg_withdrawals WHERE status = 'sending'),
    'wdSent', (SELECT count(*) FROM public.dogg_withdrawals WHERE status = 'sent'),
    'wdSentAmount', (SELECT coalesce(sum(amount), 0) FROM public.dogg_withdrawals WHERE status = 'sent'),
    'wdQueuedAmount', (SELECT coalesce(sum(amount), 0) FROM public.dogg_withdrawals WHERE status IN ('pending', 'sending'))
  );
$$;

REVOKE ALL ON FUNCTION public.dogg_task_start(bigint, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dogg_task_claim(bigint, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dogg_admin_adjust(bigint, bigint, numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dogg_admin_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dogg_task_start(bigint, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.dogg_task_claim(bigint, uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.dogg_admin_adjust(bigint, bigint, numeric, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.dogg_admin_stats() TO service_role;