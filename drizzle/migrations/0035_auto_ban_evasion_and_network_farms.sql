-- Auto-ban, four rules (accounts an admin cleared and admins never count):
-- 1) more than 5 accounts with the same device id;
-- 2) a farm burst on one phone: same phone fingerprint + same network + same inviter, more than 5 accounts within one hour
--    (plus the inviter when it is on that same phone and network);
-- 3) ban evasion: an account on the same device id as an already banned account;
-- 4) a farm burst across several phones: more than 5 recruits of the same inviter from the same network within one hour,
--    where at least one device id is reused inside that group. Different people on shared Wi-Fi use their own phones
--    (distinct device ids), so they are not hit.
CREATE OR REPLACE FUNCTION public.dogg_auto_ban(p_telegram_id bigint)
RETURNS bigint[] LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE grp bigint[]; newly bigint[] := '{}'; c record; burst int; inviter_here boolean;
BEGIN
  -- Rules 1 and 3: groups by device id.
  FOR c IN
    SELECT array_agg(DISTINCT p.telegram_id) AS ids,
      bool_or(p.banned_at IS NOT NULL) AS has_banned
    FROM dogg_signals me
      JOIN dogg_signals d ON d.kind = 'device' AND d.value = me.value
      JOIN dogg_players p ON p.telegram_id = d.telegram_id
      WHERE me.telegram_id = p_telegram_id AND me.kind = 'device'
        AND NOT p.ban_exempt AND p.telegram_id NOT IN (SELECT telegram_id FROM dogg_admins)
      GROUP BY me.value
  LOOP
    IF coalesce(array_length(c.ids, 1), 0) > 5 OR c.has_banned THEN newly := newly || dogg_ban_group(c.ids); END IF;
  END LOOP;

  -- Rule 2: one phone fingerprint + one network + one inviter.
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

  -- Rule 4: one network + one inviter, more than 5 recruits within one hour, with a device id reused among them.
  FOR c IN
    WITH my_ips AS (
      SELECT value AS ip FROM dogg_signals WHERE telegram_id = p_telegram_id AND kind = 'ip'
    ), members AS (
      SELECT DISTINCT mi.ip, p.telegram_id, p.referred_by AS inv, p.created_at FROM my_ips mi
      JOIN dogg_signals i ON i.kind = 'ip' AND i.value = mi.ip
      JOIN dogg_players p ON p.telegram_id = i.telegram_id
      WHERE p.referred_by IS NOT NULL AND NOT p.ban_exempt AND p.telegram_id NOT IN (SELECT telegram_id FROM dogg_admins)
    ), win AS (
      SELECT a.ip, a.inv, a.telegram_id AS t0, array_agg(b.telegram_id) AS ids FROM members a
      JOIN members b ON b.ip = a.ip AND b.inv = a.inv AND b.created_at >= a.created_at AND b.created_at < a.created_at + interval '1 hour'
      GROUP BY a.ip, a.inv, a.telegram_id
    )
    SELECT w.ip, w.inv, w.ids FROM win w
    WHERE array_length(w.ids, 1) > 5
      AND (SELECT count(DISTINCT value) FROM dogg_signals WHERE kind = 'device' AND telegram_id = ANY(w.ids))
        < (SELECT count(DISTINCT telegram_id) FROM dogg_signals WHERE kind = 'device' AND telegram_id = ANY(w.ids))
  LOOP
    inviter_here := EXISTS (
      SELECT 1 FROM dogg_signals i JOIN dogg_players p ON p.telegram_id = i.telegram_id
      WHERE i.telegram_id = c.inv AND i.kind = 'ip' AND i.value = c.ip
        AND NOT p.ban_exempt AND p.telegram_id NOT IN (SELECT telegram_id FROM dogg_admins));
    newly := newly || dogg_ban_group(CASE WHEN inviter_here THEN c.ids || c.inv ELSE c.ids END);
  END LOOP;
  RETURN newly;
END; $$;
REVOKE EXECUTE ON FUNCTION public.dogg_auto_ban(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dogg_auto_ban(bigint) TO service_role;

-- Apply the new rules once to accounts that already exist (they would otherwise be checked on their next visit).
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT s.telegram_id FROM dogg_signals s JOIN dogg_players p USING (telegram_id)
           WHERE p.banned_at IS NULL AND NOT p.ban_exempt LOOP
    PERFORM public.dogg_auto_ban(r.telegram_id);
  END LOOP;
END $$;