-- Bans a group: cancels+refunds its unsent withdrawals, then marks every not-exempt, non-admin account. Returns ids banned now.
CREATE OR REPLACE FUNCTION public.dogg_ban_group(p_ids bigint[])
RETURNS bigint[] LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w record; newly bigint[];
BEGIN
  FOR w IN SELECT d.id FROM dogg_withdrawals d JOIN dogg_players p ON p.telegram_id = d.telegram_id
    WHERE d.telegram_id = ANY(p_ids) AND d.status = 'pending' AND p.banned_at IS NULL AND NOT p.ban_exempt
      AND p.telegram_id NOT IN (SELECT telegram_id FROM dogg_admins) LOOP
    PERFORM dogg_withdraw_fail(w.id, 'Cancelado: cuenta suspendida por multicuentas');
  END LOOP;
  WITH u AS (
    UPDATE dogg_players SET banned_at = now(), ban_reason = 'multi_device'
    WHERE telegram_id = ANY(p_ids) AND banned_at IS NULL AND NOT ban_exempt AND telegram_id NOT IN (SELECT telegram_id FROM dogg_admins)
    RETURNING telegram_id)
  SELECT coalesce(array_agg(telegram_id), '{}') INTO newly FROM u;
  RETURN newly;
END; $$;
REVOKE EXECUTE ON FUNCTION public.dogg_ban_group(bigint[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dogg_ban_group(bigint[]) TO service_role;

-- Auto-ban, two rules (accounts an admin cleared and admins never count):
-- 1) more than 5 accounts with the same device id;
-- 2) a farm burst: same phone fingerprint + same network + same inviter (or none), with more than 5 accounts counting
--    the recruits created within one hour plus the inviter when it is on that same phone and network.
--    Different people with identical phones on shared Wi-Fi join over time or via different links, so they are not hit.
CREATE OR REPLACE FUNCTION public.dogg_auto_ban(p_telegram_id bigint)
RETURNS bigint[] LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE grp bigint[]; newly bigint[] := '{}'; c record; burst int; inviter_here boolean;
BEGIN
  FOR grp IN
    SELECT array_agg(DISTINCT p.telegram_id) FROM dogg_signals me
      JOIN dogg_signals d ON d.kind = 'device' AND d.value = me.value
      JOIN dogg_players p ON p.telegram_id = d.telegram_id
      WHERE me.telegram_id = p_telegram_id AND me.kind = 'device'
        AND NOT p.ban_exempt AND p.telegram_id NOT IN (SELECT telegram_id FROM dogg_admins)
      GROUP BY me.value
  LOOP
    IF coalesce(array_length(grp, 1), 0) > 5 THEN newly := newly || dogg_ban_group(grp); END IF;
  END LOOP;

  FOR c IN
    WITH pairs AS (
      SELECT DISTINCT mf.value AS fp, mi.value AS ip FROM dogg_signals mf
      JOIN dogg_signals mi ON mi.telegram_id = mf.telegram_id AND mi.kind = 'ip'
      WHERE mf.telegram_id = p_telegram_id AND mf.kind = 'fp'
    ), members AS (
      SELECT DISTINCT pr.fp, pr.ip, p.telegram_id, p.referred_by, p.created_at FROM pairs pr
      JOIN dogg_signals f ON f.kind = 'fp' AND f.value = pr.fp
      JOIN dogg_signals i ON i.telegram_id = f.telegram_id AND i.kind = 'ip' AND i.value = pr.ip
      JOIN dogg_players p ON p.telegram_id = f.telegram_id
      WHERE NOT p.ban_exempt AND p.telegram_id NOT IN (SELECT telegram_id FROM dogg_admins)
    )
    SELECT m.fp, m.ip, m.referred_by AS inviter, array_agg(m.telegram_id) AS ids,
      (SELECT max((SELECT count(*) FROM members b WHERE b.fp = m.fp AND b.ip = m.ip AND b.referred_by IS NOT DISTINCT FROM m.referred_by
                    AND b.created_at >= a.created_at AND b.created_at < a.created_at + interval '1 hour'))
         FROM members a WHERE a.fp = m.fp AND a.ip = m.ip AND a.referred_by IS NOT DISTINCT FROM m.referred_by) AS burst
    FROM members m GROUP BY m.fp, m.ip, m.referred_by
  LOOP
    inviter_here := c.inviter IS NOT NULL AND EXISTS (
      SELECT 1 FROM dogg_signals f JOIN dogg_signals i ON i.telegram_id = f.telegram_id AND i.kind = 'ip' AND i.value = c.ip
      JOIN dogg_players p ON p.telegram_id = f.telegram_id
      WHERE f.telegram_id = c.inviter AND f.kind = 'fp' AND f.value = c.fp
        AND NOT p.ban_exempt AND p.telegram_id NOT IN (SELECT telegram_id FROM dogg_admins));
    burst := coalesce(c.burst, 0) + CASE WHEN inviter_here THEN 1 ELSE 0 END;
    IF burst > 5 THEN
      newly := newly || dogg_ban_group(CASE WHEN inviter_here THEN c.ids || c.inviter ELSE c.ids END);
    END IF;
  END LOOP;
  RETURN newly;
END; $$;
REVOKE EXECUTE ON FUNCTION public.dogg_auto_ban(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dogg_auto_ban(bigint) TO service_role;