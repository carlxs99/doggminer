CREATE OR REPLACE FUNCTION public.dogg_verify_withdraw(p_telegram_id bigint, p_wallet text, p_bought numeric)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
-- p_bought is the linked wallet's fresh on-chain DOGG balance, read server-side. Holding at least 1 verifies once.
DECLARE p public.dogg_players;
BEGIN
  SELECT * INTO p FROM public.dogg_players WHERE telegram_id = p_telegram_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Abre de nuevo la mini app desde Telegram.'; END IF;
  IF p.withdraw_verified_at IS NOT NULL THEN RETURN true; END IF;
  IF p.wallet_address IS NULL OR p.wallet_address <> p_wallet THEN RAISE EXCEPTION 'Conecta y vincula tu wallet TON primero.'; END IF;
  IF coalesce(p_bought, 0) < 1 THEN
    RAISE EXCEPTION 'Aún no vemos tus $DOGG: tu wallet tiene % $DOGG y necesitas 1. Si acabas de comprar, espera un minuto y vuelve a verificar.', round(coalesce(p_bought, 0), 2);
  END IF;
  IF EXISTS (SELECT 1 FROM public.dogg_players WHERE withdraw_verified_wallet = p_wallet AND telegram_id <> p_telegram_id) THEN
    RAISE EXCEPTION 'Esta wallet ya verificó otra cuenta de Telegram. Usa otra wallet para verificar esta cuenta.';
  END IF;
  UPDATE public.dogg_players SET withdraw_verified_at = now(), withdraw_verified_wallet = p_wallet, withdraw_verified_amount = p_bought WHERE telegram_id = p_telegram_id;
  RETURN true;
END; $function$;
REVOKE ALL ON FUNCTION public.dogg_verify_withdraw(bigint, text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dogg_verify_withdraw(bigint, text, numeric) TO service_role;

CREATE OR REPLACE FUNCTION public.dogg_withdraw(p_telegram_id bigint, p_amount numeric)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
-- The 70 fee comes out of p_amount, so withdrawing 1000 sends 930.
DECLARE p public.dogg_players; wid uuid;
BEGIN
SELECT * INTO p FROM public.dogg_players WHERE telegram_id=p_telegram_id FOR UPDATE;
IF p IS NULL OR p.wallet_address IS NULL THEN RAISE EXCEPTION 'Conecta tu wallet antes de retirar'; END IF;
IF p.withdraw_verified_at IS NULL THEN RAISE EXCEPTION 'Verifica tu wallet (con 1 $DOGG o más) para poder retirar.'; END IF;
IF p_amount IS NULL OR p_amount < 1000 THEN RAISE EXCEPTION 'El retiro mínimo es 1000 $DOGG'; END IF;
IF p.balance < p_amount THEN RAISE EXCEPTION 'Saldo insuficiente: necesitas % $DOGG', p_amount; END IF;
UPDATE public.dogg_players SET balance = balance - p_amount WHERE telegram_id=p_telegram_id;
INSERT INTO public.dogg_withdrawals(telegram_id, amount, fee, address) VALUES (p_telegram_id, p_amount - 70, 70, p.wallet_address) RETURNING id INTO wid;
RETURN wid;
END $function$;
REVOKE ALL ON FUNCTION public.dogg_withdraw(bigint, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dogg_withdraw(bigint, numeric) TO service_role;