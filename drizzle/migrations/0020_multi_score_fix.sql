CREATE OR REPLACE FUNCTION public.dogg_multi_score(p_telegram_id bigint)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE kinds text[]; selfref boolean; score numeric;
BEGIN
  SELECT coalesce(array_agg(DISTINCT kind), '{}'::text[]) INTO kinds FROM dogg_multi_peers(p_telegram_id);
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
  IF selfref THEN kinds := array_append(kinds, 'selfref'::text); END IF;
  RETURN jsonb_build_object('score', score, 'reasons', to_jsonb(kinds));
END; $$;
REVOKE EXECUTE ON FUNCTION public.dogg_multi_score(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dogg_multi_score(bigint) TO service_role;