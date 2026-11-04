ALTER TABLE public.dogg_players ADD COLUMN IF NOT EXISTS banned_at timestamptz;
ALTER TABLE public.dogg_players ADD COLUMN IF NOT EXISTS ban_reason text;
ALTER TABLE public.dogg_players ADD COLUMN IF NOT EXISTS ban_exempt boolean NOT NULL DEFAULT false;

-- Banned accounts cannot earn, mine, spend or withdraw: any balance/shift/referral-pot change is rejected at the row level.
CREATE OR REPLACE FUNCTION public.dogg_ban_guard_players()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.banned_at IS NOT NULL AND NEW.banned_at IS NOT NULL AND (
     NEW.balance IS DISTINCT FROM OLD.balance OR NEW.shift_started_at IS DISTINCT FROM OLD.shift_started_at
     OR NEW.claimed_shifts IS DISTINCT FROM OLD.claimed_shifts OR NEW.ref_pending > OLD.ref_pending
     OR NEW.withdraw_verified_at IS DISTINCT FROM OLD.withdraw_verified_at) THEN
    RAISE EXCEPTION 'Cuenta suspendida por multicuentas.';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS dogg_ban_guard_players ON public.dogg_players;
CREATE TRIGGER dogg_ban_guard_players BEFORE UPDATE ON public.dogg_players FOR EACH ROW EXECUTE FUNCTION public.dogg_ban_guard_players();

CREATE OR REPLACE FUNCTION public.dogg_ban_guard_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM dogg_players WHERE telegram_id = NEW.telegram_id AND banned_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Cuenta suspendida por multicuentas.';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS dogg_ban_guard ON public.dogg_withdrawals;
CREATE TRIGGER dogg_ban_guard BEFORE INSERT ON public.dogg_withdrawals FOR EACH ROW EXECUTE FUNCTION public.dogg_ban_guard_insert();
DROP TRIGGER IF EXISTS dogg_ban_guard ON public.dogg_ad_views;
CREATE TRIGGER dogg_ban_guard BEFORE INSERT ON public.dogg_ad_views FOR EACH ROW EXECUTE FUNCTION public.dogg_ban_guard_insert();
DROP TRIGGER IF EXISTS dogg_ban_guard ON public.dogg_task_claims;
CREATE TRIGGER dogg_ban_guard BEFORE INSERT ON public.dogg_task_claims FOR EACH ROW EXECUTE FUNCTION public.dogg_ban_guard_insert();

-- More than 5 accounts on the same device: ban every account of that device (except admin-exempted ones),
-- cancelling their not-yet-sent withdrawals first. Returns the ids banned now.
CREATE OR REPLACE FUNCTION public.dogg_auto_ban(p_telegram_id bigint)
RETURNS bigint[] LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE dev text; ids bigint[]; newly bigint[] := '{}'; w record;
BEGIN
  FOR dev IN SELECT value FROM dogg_signals WHERE telegram_id = p_telegram_id AND kind = 'device' LOOP
    SELECT array_agg(DISTINCT telegram_id) INTO ids FROM dogg_signals WHERE kind = 'device' AND value = dev;
    IF coalesce(array_length(ids, 1), 0) > 5 THEN
      FOR w IN SELECT id FROM dogg_withdrawals WHERE telegram_id = ANY(ids) AND status = 'pending'
        AND telegram_id IN (SELECT telegram_id FROM dogg_players WHERE banned_at IS NULL AND NOT ban_exempt) LOOP
        PERFORM dogg_withdraw_fail(w.id, 'Cancelado: cuenta suspendida por multicuentas');
      END LOOP;
      WITH u AS (
        UPDATE dogg_players SET banned_at = now(), ban_reason = 'multi_device'
        WHERE telegram_id = ANY(ids) AND banned_at IS NULL AND NOT ban_exempt AND telegram_id NOT IN (SELECT telegram_id FROM dogg_admins)
        RETURNING telegram_id)
      SELECT newly || coalesce(array_agg(telegram_id), '{}') INTO newly FROM u;
    END IF;
  END LOOP;
  RETURN newly;
END; $$;
REVOKE EXECUTE ON FUNCTION public.dogg_auto_ban(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dogg_auto_ban(bigint) TO service_role;

CREATE OR REPLACE FUNCTION public.dogg_admin_set_ban(p_admin bigint, p_telegram_id bigint, p_banned boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM dogg_admins WHERE telegram_id = p_admin) THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF p_banned THEN
    UPDATE dogg_players SET banned_at = now(), ban_reason = 'admin', ban_exempt = false WHERE telegram_id = p_telegram_id AND banned_at IS NULL;
  ELSE
    UPDATE dogg_players SET banned_at = NULL, ban_reason = NULL, ban_exempt = true WHERE telegram_id = p_telegram_id;
  END IF;
  INSERT INTO dogg_admin_log (admin_id, action, details) VALUES (p_admin, CASE WHEN p_banned THEN 'ban' ELSE 'unban' END, jsonb_build_object('telegram_id', p_telegram_id));
END; $$;
REVOKE EXECUTE ON FUNCTION public.dogg_admin_set_ban(bigint, bigint, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dogg_admin_set_ban(bigint, bigint, boolean) TO service_role;