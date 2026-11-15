CREATE OR REPLACE VIEW public.dogg_global_game_history AS
SELECT 'mines:' || g.id::text AS id, 'mines'::text AS game, g.bet, g.payout, g.ended_at AS played_at,
coalesce(nullif(btrim(p.first_name), ''), '@' || nullif(btrim(p.username), '')) AS player_name
FROM public.dogg_mines_games g
LEFT JOIN public.dogg_players p ON p.telegram_id = g.telegram_id
WHERE g.status IN ('won','lost') AND g.ended_at IS NOT NULL
UNION ALL
SELECT 'spin:' || b.id::text AS id, 'spin'::text AS game, -b.amount AS bet, coalesce(w.amount, 0) AS payout, b.created_at AS played_at,
coalesce(nullif(btrim(p.first_name), ''), '@' || nullif(btrim(p.username), '')) AS player_name
FROM public.dogg_ledger b
LEFT JOIN public.dogg_players p ON p.telegram_id = b.telegram_id
LEFT JOIN LATERAL (
 SELECT l.amount FROM public.dogg_ledger l
 WHERE l.kind = 'game' AND l.label = 'hist.spinWin' AND l.telegram_id = b.telegram_id AND l.created_at = b.created_at AND l.id > b.id
 ORDER BY l.id ASC LIMIT 1
) w ON true
WHERE b.kind = 'game' AND b.label = 'hist.spinBet';
REVOKE ALL ON public.dogg_global_game_history FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.dogg_global_game_history TO anon, authenticated, service_role;
COMMENT ON VIEW public.dogg_global_game_history IS 'Public completed rounds and Telegram display name (public username fallback) only. Owner-context projection exposes no Telegram ids, wallets, balances, board, or active rounds. Spin debit and payout share the transaction timestamp; FREE spins are one paid round.';