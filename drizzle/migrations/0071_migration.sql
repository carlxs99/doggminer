CREATE TABLE public.dogg_mines_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id bigint NOT NULL,
  bet numeric NOT NULL,
  mines int NOT NULL,
  board int[] NOT NULL,
  revealed int[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active',
  payout numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);
GRANT ALL ON public.dogg_mines_games TO service_role;
ALTER TABLE public.dogg_mines_games ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX dogg_mines_one_active ON public.dogg_mines_games (telegram_id) WHERE status = 'active';
CREATE INDEX dogg_mines_player ON public.dogg_mines_games (telegram_id, created_at DESC);

-- Multiplier after k safe picks with m mines on 25 tiles, 4% house edge, capped at 100x.
CREATE OR REPLACE FUNCTION public.dogg_mines_mult(p_mines int, p_k int) RETURNS numeric LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $$
DECLARE r numeric := 1; i int;
BEGIN
  IF p_k <= 0 THEN RETURN 1; END IF;
  FOR i IN 0..p_k-1 LOOP r := r * (25 - i)::numeric / (25 - p_mines - i); END LOOP;
  RETURN least(100, floor(r * 0.96 * 100) / 100);
END $$;

CREATE OR REPLACE FUNCTION public.dogg_mines_view(g dogg_mines_games) RETURNS jsonb LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT jsonb_build_object('id', g.id, 'bet', g.bet, 'mines', g.mines, 'revealed', to_jsonb(g.revealed), 'status', g.status, 'payout', g.payout,
    'mult', dogg_mines_mult(g.mines, coalesce(array_length(g.revealed,1),0)),
    'next', dogg_mines_mult(g.mines, coalesce(array_length(g.revealed,1),0) + 1),
    'board', CASE WHEN g.status = 'active' THEN NULL ELSE to_jsonb(g.board) END,
    'balance', (SELECT balance FROM dogg_players WHERE telegram_id = g.telegram_id));
$$;

-- p_action: read | start | reveal | cashout. Board stays server-side until the round ends.
CREATE OR REPLACE FUNCTION public.dogg_mines(p_telegram_id bigint, p_action text, p_bet numeric DEFAULT NULL, p_mines int DEFAULT NULL, p_tile int DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE pl dogg_players; g dogg_mines_games; k int; win numeric;
BEGIN
  SELECT * INTO pl FROM dogg_players WHERE telegram_id = p_telegram_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Jugador no encontrado'; END IF;
  IF pl.banned_at IS NOT NULL THEN RAISE EXCEPTION 'Cuenta bloqueada'; END IF;
  SELECT * INTO g FROM dogg_mines_games WHERE telegram_id = p_telegram_id AND status = 'active' FOR UPDATE;

  IF p_action = 'read' THEN
    IF g.id IS NULL THEN RETURN jsonb_build_object('balance', pl.balance); END IF;
    RETURN dogg_mines_view(g);
  ELSIF p_action = 'start' THEN
    IF g.id IS NOT NULL THEN RAISE EXCEPTION 'Ya tienes una partida en curso'; END IF;
    IF p_mines NOT IN (3,5,10) THEN RAISE EXCEPTION 'Número de minas no válido'; END IF;
    IF p_bet IS NULL OR p_bet < 5 OR p_bet > 100 OR p_bet <> floor(p_bet) THEN RAISE EXCEPTION 'Apuesta entre 5 y 100 $DOGG'; END IF;
    IF pl.balance < p_bet THEN RAISE EXCEPTION 'Saldo insuficiente'; END IF;
    UPDATE dogg_players SET balance = balance - p_bet WHERE telegram_id = p_telegram_id;
    INSERT INTO dogg_ledger (telegram_id, kind, label, amount) VALUES (p_telegram_id, 'game', 'hist.gameBet', -p_bet);
    INSERT INTO dogg_mines_games (telegram_id, bet, mines, board)
      VALUES (p_telegram_id, p_bet, p_mines, (SELECT array_agg(x ORDER BY x) FROM (SELECT x FROM generate_series(0,24) x ORDER BY gen_random_uuid() LIMIT p_mines) s))
      RETURNING * INTO g;
    RETURN dogg_mines_view(g);
  ELSIF p_action = 'reveal' THEN
    IF g.id IS NULL THEN RAISE EXCEPTION 'No hay partida en curso'; END IF;
    IF p_tile IS NULL OR p_tile < 0 OR p_tile > 24 THEN RAISE EXCEPTION 'Casilla no válida'; END IF;
    IF p_tile = ANY(g.revealed) THEN RETURN dogg_mines_view(g); END IF;
    IF p_tile = ANY(g.board) THEN
      UPDATE dogg_mines_games SET status = 'lost', revealed = revealed || p_tile, ended_at = now() WHERE id = g.id RETURNING * INTO g;
      RETURN dogg_mines_view(g) || jsonb_build_object('hit', p_tile);
    END IF;
    UPDATE dogg_mines_games SET revealed = revealed || p_tile WHERE id = g.id RETURNING * INTO g;
    k := array_length(g.revealed,1);
    IF k >= 25 - g.mines OR dogg_mines_mult(g.mines, k) >= 100 THEN p_action := 'cashout'; ELSE RETURN dogg_mines_view(g); END IF;
  END IF;

  IF p_action = 'cashout' THEN
    IF g.id IS NULL THEN RAISE EXCEPTION 'No hay partida en curso'; END IF;
    k := coalesce(array_length(g.revealed,1),0);
    IF k = 0 THEN RAISE EXCEPTION 'Destapa al menos una casilla'; END IF;
    win := floor(g.bet * dogg_mines_mult(g.mines, k) * 100) / 100;
    UPDATE dogg_players SET balance = balance + win WHERE telegram_id = p_telegram_id;
    INSERT INTO dogg_ledger (telegram_id, kind, label, amount) VALUES (p_telegram_id, 'game', 'hist.gameWin', win);
    UPDATE dogg_mines_games SET status = 'won', payout = win, ended_at = now() WHERE id = g.id RETURNING * INTO g;
    RETURN dogg_mines_view(g);
  END IF;
  RAISE EXCEPTION 'Acción no válida';
END $$;
REVOKE ALL ON FUNCTION public.dogg_mines(bigint,text,numeric,int,int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dogg_mines(bigint,text,numeric,int,int) TO service_role;