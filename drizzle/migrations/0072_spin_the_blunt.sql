CREATE OR REPLACE FUNCTION public.dogg_spin(p_telegram_id bigint, p_bet numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  pl dogg_players;
  mults numeric[] := ARRAY[25,0.5,1.2,3,1,10,0,1.5,2,1,8,0.5,1.4,4,-1,5,0,1.8,2.5,1];
  weights int[] := ARRAY[10,800,600,200,500,30,1645,600,400,500,40,800,600,100,200,80,1645,500,250,500];
  slots int[] := '{}'; r int; acc int; i int; total numeric := 0; n int := 0;
BEGIN
  SELECT * INTO pl FROM dogg_players WHERE telegram_id = p_telegram_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Jugador no encontrado'; END IF;
  IF pl.banned_at IS NOT NULL THEN RAISE EXCEPTION 'Cuenta bloqueada'; END IF;
  IF p_bet IS NULL OR p_bet < 5 OR p_bet > 100 OR p_bet <> floor(p_bet) THEN RAISE EXCEPTION 'Apuesta entre 5 y 100 $DOGG'; END IF;
  IF pl.balance < p_bet THEN RAISE EXCEPTION 'Saldo insuficiente'; END IF;
  UPDATE dogg_players SET balance = balance - p_bet WHERE telegram_id = p_telegram_id;
  INSERT INTO dogg_ledger (telegram_id, kind, label, amount) VALUES (p_telegram_id, 'game', 'hist.spinBet', -p_bet);
  LOOP
    n := n + 1;
    r := (('x' || substr(md5(gen_random_uuid()::text), 1, 8))::bit(32)::bigint % 10000)::int;
    acc := 0;
    FOR i IN 1..20 LOOP acc := acc + weights[i]; EXIT WHEN r < acc; END LOOP;
    slots := slots || (i - 1);
    EXIT WHEN mults[i] >= 0 OR n >= 5;
  END LOOP;
  IF mults[i] > 0 THEN total := floor(p_bet * mults[i] * 100) / 100; ELSIF mults[i] < 0 THEN total := p_bet; END IF;
  IF total > 0 THEN
    UPDATE dogg_players SET balance = balance + total WHERE telegram_id = p_telegram_id;
    INSERT INTO dogg_ledger (telegram_id, kind, label, amount) VALUES (p_telegram_id, 'game', 'hist.spinWin', total);
  END IF;
  SELECT balance INTO pl.balance FROM dogg_players WHERE telegram_id = p_telegram_id;
  RETURN jsonb_build_object('balance', pl.balance, 'slots', to_jsonb(slots), 'payout', total, 'bet', p_bet);
END $$;
REVOKE ALL ON FUNCTION public.dogg_spin(bigint, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dogg_spin(bigint, numeric) TO service_role;