CREATE OR REPLACE FUNCTION public.dogg_multi_report(p_min_score numeric DEFAULT 15)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE out jsonb;
BEGIN
  WITH candidates AS (
    SELECT DISTINCT s1.telegram_id AS id FROM dogg_signals s1
    JOIN dogg_signals s2 ON s2.kind = s1.kind AND s2.value = s1.value AND s2.telegram_id <> s1.telegram_id
    UNION
    SELECT DISTINCT w1.telegram_id FROM dogg_wallet_links w1
    JOIN dogg_wallet_links w2 ON w2.wallet_address = w1.wallet_address AND w2.telegram_id <> w1.telegram_id
  ), scored AS (
    SELECT c.id, dogg_multi_score(c.id) AS r FROM candidates c
  ), rows AS (
    SELECT s.id, (s.r->>'score')::numeric AS score, s.r->'reasons' AS reasons, p.first_name, p.username, p.balance, p.created_at, p.referred_by,
      p.withdraw_verified_at IS NOT NULL AS can_withdraw, p.wallet_address IS NOT NULL AS has_wallet,
      p.banned_at IS NOT NULL AS banned,
      (SELECT country FROM dogg_signals WHERE telegram_id = s.id AND country IS NOT NULL ORDER BY last_seen DESC LIMIT 1) AS country,
      (SELECT coalesce(jsonb_agg(jsonb_build_object('id', x.peer, 'name', coalesce(pp.first_name, pp.username, 'Homie'), 'username', pp.username, 'kinds', x.kinds, 'balance', coalesce(pp.balance, 0)) ORDER BY x.peer), '[]'::jsonb)
         FROM (SELECT peer, jsonb_agg(DISTINCT kind) AS kinds FROM dogg_multi_peers(s.id) GROUP BY peer) x
         LEFT JOIN dogg_players pp ON pp.telegram_id = x.peer) AS peers,
      rv.status AS review, rv.score AS review_score, rv.note AS review_note
    FROM scored s
    LEFT JOIN dogg_players p ON p.telegram_id = s.id
    LEFT JOIN dogg_multi_reviews rv ON rv.telegram_id = s.id
  )
  SELECT coalesce(jsonb_agg(to_jsonb(rows) ORDER BY score DESC, id), '[]'::jsonb) INTO out
  FROM (SELECT * FROM rows WHERE score >= p_min_score ORDER BY score DESC, id LIMIT 200) rows;
  RETURN out;
END; $function$;