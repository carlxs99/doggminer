CREATE OR REPLACE FUNCTION public.dogg_flip(p_telegram_id bigint, p_bet numeric, p_side text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE pl dogg_players; res text; total numeric := 0;
BEGIN
  SELECT * INTO pl FROM dogg_players WHERE telegram_id = p_telegram_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Jugador no encontrado'; END IF;
  IF pl.banned_at IS NOT NULL THEN RAISE EXCEPTION 'Cuenta bloqueada'; END IF;
  IF p_side IS NULL OR p_side NOT IN ('heads','tails') THEN RAISE EXCEPTION 'No se pudo completar la jugada'; END IF;
  IF p_bet IS NULL OR p_bet < 5 OR p_bet > 100 OR p_bet <> floor(p_bet) THEN RAISE EXCEPTION 'Apuesta entre 5 y 100 $DOGG'; END IF;
  IF pl.balance < p_bet THEN RAISE EXCEPTION 'Saldo insuficiente'; END IF;
  UPDATE dogg_players SET balance = balance - p_bet WHERE telegram_id = p_telegram_id;
  INSERT INTO dogg_ledger (telegram_id, kind, label, amount) VALUES (p_telegram_id, 'game', 'hist.flipBet', -p_bet);
  res := CASE WHEN (('x' || substr(md5(gen_random_uuid()::text), 1, 8))::bit(32)::bigint % 2) = 0 THEN 'heads' ELSE 'tails' END;
  IF res = p_side THEN
    total := floor(p_bet * 1.95 * 100) / 100;
    UPDATE dogg_players SET balance = balance + total WHERE telegram_id = p_telegram_id;
    INSERT INTO dogg_ledger (telegram_id, kind, label, amount) VALUES (p_telegram_id, 'game', 'hist.flipWin', total);
  END IF;
  SELECT balance INTO pl.balance FROM dogg_players WHERE telegram_id = p_telegram_id;
  RETURN jsonb_build_object('balance', pl.balance, 'result', res, 'side', p_side, 'payout', total, 'bet', p_bet);
END $$;
REVOKE ALL ON FUNCTION public.dogg_flip(bigint, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dogg_flip(bigint, numeric, text) TO service_role;

CREATE OR REPLACE VIEW public.dogg_global_game_history AS
SELECT 'mines:' || g.id::text AS id, 'mines'::text AS game, g.bet, g.payout, g.ended_at AS played_at,
coalesce(nullif(btrim(p.first_name), ''), '@' || nullif(btrim(p.username), '')) AS player_name
FROM public.dogg_mines_games g
LEFT JOIN public.dogg_players p ON p.telegram_id = g.telegram_id
WHERE g.status IN ('won','lost') AND g.ended_at IS NOT NULL
UNION ALL
SELECT CASE b.label WHEN 'hist.spinBet' THEN 'spin:' ELSE 'flip:' END || b.id::text AS id,
CASE b.label WHEN 'hist.spinBet' THEN 'spin' ELSE 'flip' END::text AS game,
-b.amount AS bet, coalesce(w.amount, 0) AS payout, b.created_at AS played_at,
coalesce(nullif(btrim(p.first_name), ''), '@' || nullif(btrim(p.username), '')) AS player_name
FROM public.dogg_ledger b
LEFT JOIN public.dogg_players p ON p.telegram_id = b.telegram_id
LEFT JOIN LATERAL (
 SELECT l.amount FROM public.dogg_ledger l
 WHERE l.kind = 'game' AND l.label = CASE b.label WHEN 'hist.spinBet' THEN 'hist.spinWin' ELSE 'hist.flipWin' END
   AND l.telegram_id = b.telegram_id AND l.created_at = b.created_at AND l.id > b.id
 ORDER BY l.id ASC LIMIT 1
) w ON true
WHERE b.kind = 'game' AND b.label IN ('hist.spinBet','hist.flipBet');
REVOKE ALL ON public.dogg_global_game_history FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.dogg_global_game_history TO anon, authenticated, service_role;
COMMENT ON VIEW public.dogg_global_game_history IS 'Public completed rounds and Telegram display name (public username fallback) only. Owner-context projection exposes no Telegram ids, wallets, balances, board, or active rounds. Spin/flip debit and payout share the transaction timestamp; FREE spins are one paid round.';