CREATE OR REPLACE FUNCTION public.dogg_verify_withdraw(p_telegram_id bigint, p_wallet text, p_bought numeric)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
-- p_bought is now the linked wallet's on-chain $DOGG balance (read server-side); holding 100 verifies withdrawals once.
DECLARE p public.dogg_players;
BEGIN
  SELECT * INTO p FROM public.dogg_players WHERE telegram_id = p_telegram_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Abre de nuevo la mini app desde Telegram.'; END IF;
  IF p.withdraw_verified_at IS NOT NULL THEN RETURN true; END IF;
  IF p.wallet_address IS NULL OR p.wallet_address <> p_wallet THEN RAISE EXCEPTION 'Conecta y vincula tu wallet TON primero.'; END IF;
  IF coalesce(p_bought, 0) < 100 THEN
    RAISE EXCEPTION 'Aún no vemos tus $DOGG: tu wallet tiene % $DOGG y necesitas 100. Si acabas de comprar, espera un minuto y vuelve a verificar.', round(coalesce(p_bought, 0), 2);
  END IF;
  IF EXISTS (SELECT 1 FROM public.dogg_players WHERE withdraw_verified_wallet = p_wallet AND telegram_id <> p_telegram_id) THEN
    RAISE EXCEPTION 'Esta wallet ya verificó otra cuenta de Telegram. Usa otra wallet para verificar esta cuenta.';
  END IF;
  UPDATE public.dogg_players SET withdraw_verified_at = now(), withdraw_verified_wallet = p_wallet, withdraw_verified_amount = p_bought WHERE telegram_id = p_telegram_id;
  RETURN true;
END; $$;