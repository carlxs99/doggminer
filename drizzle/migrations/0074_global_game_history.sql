CREATE INDEX IF NOT EXISTS dogg_mines_history_time_idx ON public.dogg_mines_games (ended_at DESC, id DESC) WHERE status IN ('won','lost');
CREATE INDEX IF NOT EXISTS dogg_spin_history_time_idx ON public.dogg_ledger (created_at DESC, id DESC) WHERE kind = 'game' AND label = 'hist.spinBet';
CREATE INDEX IF NOT EXISTS dogg_spin_history_win_idx ON public.dogg_ledger (telegram_id, created_at, id) WHERE kind = 'game' AND label = 'hist.spinWin';
CREATE OR REPLACE VIEW public.dogg_global_game_history AS
SELECT 'mines:' || g.id::text AS id, 'mines'::text AS game, g.bet, g.payout, g.ended_at AS played_at
FROM public.dogg_mines_games g WHERE g.status IN ('won','lost') AND g.ended_at IS NOT NULL
UNION ALL
SELECT 'spin:' || b.id::text AS id, 'spin'::text AS game, -b.amount AS bet, coalesce(w.amount, 0) AS payout, b.created_at AS played_at
FROM public.dogg_ledger b
LEFT JOIN LATERAL (
 SELECT l.amount FROM public.dogg_ledger l
 WHERE l.kind = 'game' AND l.label = 'hist.spinWin' AND l.telegram_id = b.telegram_id AND l.created_at = b.created_at AND l.id > b.id
 ORDER BY l.id ASC LIMIT 1
) w ON true
WHERE b.kind = 'game' AND b.label = 'hist.spinBet';
REVOKE ALL ON public.dogg_global_game_history FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.dogg_global_game_history TO anon, authenticated, service_role;
COMMENT ON VIEW public.dogg_global_game_history IS 'Public anonymous completed rounds only. Owner-context projection intentionally exposes no Telegram ids, wallets, balances, board, or active rounds. Spin debit and payout share the transaction timestamp; FREE spins are one paid round.';