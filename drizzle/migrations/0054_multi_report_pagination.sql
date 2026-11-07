CREATE OR REPLACE FUNCTION public.dogg_multi_report_page(p_filter text DEFAULT 'all', p_offset integer DEFAULT 0, p_limit integer DEFAULT 20)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
WITH active_signals AS MATERIALIZED (
 SELECT telegram_id, kind, value FROM dogg_signals WHERE kind <> 'ip' OR last_seen > now() - interval '14 days'
), shared AS MATERIALIZED (
 SELECT kind, value FROM active_signals GROUP BY kind,value HAVING count(DISTINCT telegram_id)>1
), shared_wallets AS MATERIALIZED (
 SELECT wallet_address FROM dogg_wallet_links GROUP BY wallet_address HAVING count(DISTINCT telegram_id)>1
), linked AS (
 SELECT DISTINCT s.telegram_id AS id,s.kind FROM active_signals s JOIN shared g USING(kind,value)
 UNION SELECT w.telegram_id,'wallet' FROM dogg_wallet_links w JOIN shared_wallets g USING(wallet_address)
), selfrefs AS MATERIALIZED (
 SELECT DISTINCT c.telegram_id AS child,c.referred_by AS parent FROM dogg_players c
 JOIN active_signals a ON a.telegram_id=c.telegram_id
 JOIN active_signals b ON b.telegram_id=c.referred_by AND b.kind=a.kind AND b.value=a.value
 WHERE c.telegram_id<>c.referred_by
 UNION
 SELECT DISTINCT c.telegram_id,c.referred_by FROM dogg_players c
 JOIN dogg_wallet_links a ON a.telegram_id=c.telegram_id
 JOIN dogg_wallet_links b ON b.telegram_id=c.referred_by AND b.wallet_address=a.wallet_address
 WHERE c.telegram_id<>c.referred_by
), selfref_ids AS (SELECT child AS id FROM selfrefs UNION SELECT parent FROM selfrefs), kinds AS (
 SELECT id,array_agg(kind ORDER BY kind) AS kinds FROM linked GROUP BY id
), scored AS MATERIALIZED (
 SELECT k.id,least(100,(CASE WHEN 'device'=ANY(k.kinds) THEN 60 ELSE 0 END)+(CASE WHEN 'fp'=ANY(k.kinds) THEN 30 ELSE 0 END)+(CASE WHEN 'ip'=ANY(k.kinds) THEN 15 ELSE 0 END)+(CASE WHEN 'wallet'=ANY(k.kinds) THEN 50 ELSE 0 END)+(CASE WHEN sr.id IS NOT NULL THEN 25 ELSE 0 END)) AS score,
 to_jsonb(CASE WHEN sr.id IS NOT NULL THEN array_append(k.kinds,'selfref') ELSE k.kinds END) AS reasons,
 p.first_name,p.username,p.balance,p.created_at,p.referred_by,p.withdraw_verified_at IS NOT NULL AS can_withdraw,p.wallet_address IS NOT NULL AS has_wallet,p.banned_at IS NOT NULL AS banned,
 rv.status AS review,rv.score AS review_score,rv.note AS review_note
 FROM kinds k JOIN dogg_players p ON p.telegram_id=k.id LEFT JOIN selfref_ids sr ON sr.id=k.id LEFT JOIN dogg_multi_reviews rv ON rv.telegram_id=k.id
), filtered AS MATERIALIZED (
 SELECT * FROM scored WHERE p_filter='all' OR (p_filter='high' AND score>=70) OR (p_filter='flagged' AND review='flagged') OR (p_filter='pending' AND (review IS NULL OR (review='ok' AND score>coalesce(review_score,0))))
), page AS MATERIALIZED (
 SELECT * FROM filtered ORDER BY score DESC,id OFFSET greatest(p_offset,0) LIMIT least(greatest(p_limit,1),50)
), detailed AS (
 SELECT p.*,
 (SELECT country FROM dogg_signals WHERE telegram_id=p.id AND country IS NOT NULL ORDER BY last_seen DESC LIMIT 1) AS country,
 coalesce(d.peers,'[]'::jsonb) AS peers,coalesce(d.peer_count,0) AS peer_count
 FROM page p LEFT JOIN LATERAL (
 SELECT max(x.total) AS peer_count,jsonb_agg(jsonb_build_object('id',x.peer,'name',coalesce(pp.first_name,pp.username,'Homie'),'username',pp.username,'kinds',x.kinds,'balance',coalesce(pp.balance,0)) ORDER BY x.peer) AS peers
 FROM (SELECT peer,jsonb_agg(DISTINCT kind ORDER BY kind) AS kinds,count(*) OVER() AS total FROM dogg_multi_peers(p.id) GROUP BY peer ORDER BY peer LIMIT 20) x
 LEFT JOIN dogg_players pp ON pp.telegram_id=x.peer
 ) d ON true
)
SELECT jsonb_build_object('total',(SELECT count(*) FROM filtered),'linked',(SELECT count(*) FROM scored),'high',(SELECT count(*) FROM scored WHERE score>=70),'rows',coalesce((SELECT jsonb_agg(to_jsonb(d) ORDER BY score DESC,id) FROM detailed d),'[]'::jsonb));
$$;
REVOKE ALL ON FUNCTION public.dogg_multi_report_page(text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dogg_multi_report_page(text,integer,integer) TO service_role;