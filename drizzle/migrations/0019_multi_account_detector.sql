-- Anonymous device/network signals per player (values are server-side HMAC hashes, never raw data).
CREATE TABLE public.dogg_signals (
  telegram_id bigint NOT NULL,
  kind text NOT NULL CHECK (kind IN ('device', 'fp', 'ip')),
  value text NOT NULL,
  country text,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  hits integer NOT NULL DEFAULT 1,
  PRIMARY KEY (telegram_id, kind, value)
);
GRANT ALL ON public.dogg_signals TO service_role;
ALTER TABLE public.dogg_signals ENABLE ROW LEVEL SECURITY;
CREATE INDEX dogg_signals_value ON public.dogg_signals (kind, value);

-- Admin decisions on suspicious accounts (only informative: nothing is blocked automatically).
CREATE TABLE public.dogg_multi_reviews (
  telegram_id bigint PRIMARY KEY,
  status text NOT NULL CHECK (status IN ('ok', 'flagged')),
  score numeric NOT NULL DEFAULT 0,
  note text,
  admin_id bigint NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.dogg_multi_reviews TO service_role;
ALTER TABLE public.dogg_multi_reviews ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.dogg_players ADD COLUMN IF NOT EXISTS multi_alerted_at timestamptz;

-- Accounts linked to a player and through which signal. Network (ip) links only count when both were seen in the last 14 days.
CREATE OR REPLACE FUNCTION public.dogg_multi_peers(p_telegram_id bigint)
RETURNS TABLE (peer bigint, kind text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT s2.telegram_id, s1.kind
  FROM dogg_signals s1
  JOIN dogg_signals s2 ON s2.kind = s1.kind AND s2.value = s1.value AND s2.telegram_id <> s1.telegram_id
  WHERE s1.telegram_id = p_telegram_id
    AND (s1.kind <> 'ip' OR (s1.last_seen > now() - interval '14 days' AND s2.last_seen > now() - interval '14 days'))
  UNION
  SELECT DISTINCT w2.telegram_id, 'wallet'
  FROM dogg_wallet_links w1
  JOIN dogg_wallet_links w2 ON w2.wallet_address = w1.wallet_address AND w2.telegram_id <> w1.telegram_id
  WHERE w1.telegram_id = p_telegram_id
$$;

-- Risk 0-100: same device +60, same device fingerprint +30, same network +15, shared wallet +50,
-- inviter/recruit is one of those linked accounts (self-referral) +25.
CREATE OR REPLACE FUNCTION public.dogg_multi_score(p_telegram_id bigint)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE kinds text[]; selfref boolean; score numeric;
BEGIN
  SELECT coalesce(array_agg(DISTINCT kind), '{}') INTO kinds FROM dogg_multi_peers(p_telegram_id);
  SELECT EXISTS (
    SELECT 1 FROM dogg_multi_peers(p_telegram_id) pr
    JOIN dogg_players me ON me.telegram_id = p_telegram_id
    LEFT JOIN dogg_players r ON r.telegram_id = pr.peer
    WHERE pr.kind IN ('device', 'fp', 'ip', 'wallet') AND (pr.peer = me.referred_by OR r.referred_by = p_telegram_id)
  ) INTO selfref;
  score := least(100,
    CASE WHEN 'device' = ANY(kinds) THEN 60 ELSE 0 END +
    CASE WHEN 'fp' = ANY(kinds) THEN 30 ELSE 0 END +
    CASE WHEN 'ip' = ANY(kinds) THEN 15 ELSE 0 END +
    CASE WHEN 'wallet' = ANY(kinds) THEN 50 ELSE 0 END +
    CASE WHEN selfref THEN 25 ELSE 0 END);
  IF selfref THEN kinds := kinds || 'selfref'; END IF;
  RETURN jsonb_build_object('score', score, 'reasons', to_jsonb(kinds));
END; $$;

-- Saves this visit's signals and tells the server whether to alert the admins (first time an account reaches 70).
CREATE OR REPLACE FUNCTION public.dogg_record_signals(p_telegram_id bigint, p_signals jsonb, p_country text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s jsonb; res jsonb; sc numeric; alert boolean := false; rv dogg_multi_reviews;
BEGIN
  FOR s IN SELECT * FROM jsonb_array_elements(coalesce(p_signals, '[]'::jsonb)) LOOP
    IF (s->>'kind') IN ('device', 'fp', 'ip') AND length(coalesce(s->>'value', '')) BETWEEN 8 AND 128 THEN
      INSERT INTO dogg_signals (telegram_id, kind, value, country) VALUES (p_telegram_id, s->>'kind', s->>'value', left(p_country, 4))
      ON CONFLICT (telegram_id, kind, value) DO UPDATE SET last_seen = now(), hits = dogg_signals.hits + 1, country = coalesce(excluded.country, dogg_signals.country);
    END IF;
  END LOOP;
  res := dogg_multi_score(p_telegram_id);
  sc := (res->>'score')::numeric;
  SELECT * INTO rv FROM dogg_multi_reviews WHERE telegram_id = p_telegram_id;
  IF sc >= 70 AND (rv.telegram_id IS NULL OR (rv.status = 'ok' AND sc > rv.score)) THEN
    UPDATE dogg_players SET multi_alerted_at = now() WHERE telegram_id = p_telegram_id AND multi_alerted_at IS NULL;
    alert := FOUND;
  END IF;
  RETURN res || jsonb_build_object('alert', alert);
END; $$;

-- Admin report: every account linked to another one, with its risk, reasons, linked accounts and review.
CREATE OR REPLACE FUNCTION public.dogg_multi_report(p_min_score numeric DEFAULT 15)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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
END; $$;

REVOKE EXECUTE ON FUNCTION public.dogg_multi_peers(bigint), public.dogg_multi_score(bigint), public.dogg_record_signals(bigint, jsonb, text), public.dogg_multi_report(numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dogg_multi_peers(bigint), public.dogg_multi_score(bigint), public.dogg_record_signals(bigint, jsonb, text), public.dogg_multi_report(numeric) TO service_role;