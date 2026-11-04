-- "Same phone" = same device id OR (same phone fingerprint AND same network). The fingerprint+network pair
-- catches farms that reset the device id between accounts; fingerprint or network alone is never enough.
CREATE OR REPLACE FUNCTION public.dogg_auto_ban(p_telegram_id bigint)
RETURNS bigint[] LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE grp bigint[]; newly bigint[] := '{}'; w record;
BEGIN
  FOR grp IN
    SELECT array_agg(DISTINCT d.telegram_id) FROM dogg_signals me
      JOIN dogg_signals d ON d.kind = 'device' AND d.value = me.value
      WHERE me.telegram_id = p_telegram_id AND me.kind = 'device' GROUP BY me.value
    UNION ALL
    SELECT array_agg(DISTINCT f.telegram_id) FROM dogg_signals mf
      JOIN dogg_signals mi ON mi.telegram_id = mf.telegram_id AND mi.kind = 'ip'
      JOIN dogg_signals f ON f.kind = 'fp' AND f.value = mf.value
      JOIN dogg_signals i ON i.telegram_id = f.telegram_id AND i.kind = 'ip' AND i.value = mi.value
      WHERE mf.telegram_id = p_telegram_id AND mf.kind = 'fp' GROUP BY mf.value, mi.value
  LOOP
    IF coalesce(array_length(grp, 1), 0) > 5 THEN
      FOR w IN SELECT id FROM dogg_withdrawals WHERE telegram_id = ANY(grp) AND status = 'pending'
        AND telegram_id IN (SELECT telegram_id FROM dogg_players WHERE banned_at IS NULL AND NOT ban_exempt)
        AND telegram_id NOT IN (SELECT telegram_id FROM dogg_admins) LOOP
        PERFORM dogg_withdraw_fail(w.id, 'Cancelado: cuenta suspendida por multicuentas');
      END LOOP;
      WITH u AS (
        UPDATE dogg_players SET banned_at = now(), ban_reason = 'multi_device'
        WHERE telegram_id = ANY(grp) AND banned_at IS NULL AND NOT ban_exempt AND telegram_id NOT IN (SELECT telegram_id FROM dogg_admins)
        RETURNING telegram_id)
      SELECT newly || coalesce(array_agg(telegram_id), '{}') INTO newly FROM u;
    END IF;
  END LOOP;
  RETURN newly;
END; $$;
REVOKE EXECUTE ON FUNCTION public.dogg_auto_ban(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dogg_auto_ban(bigint) TO service_role;