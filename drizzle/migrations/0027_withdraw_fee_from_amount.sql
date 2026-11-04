CREATE OR REPLACE FUNCTION public.dogg_withdraw(p_telegram_id bigint, p_amount numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
-- p_amount is what leaves the app balance; the 70 fee comes out of it, so the wallet receives p_amount - 70.
DECLARE p public.dogg_players; wid uuid;
BEGIN
SELECT * INTO p FROM public.dogg_players WHERE telegram_id=p_telegram_id FOR UPDATE;
IF p IS NULL OR p.wallet_address IS NULL THEN RAISE EXCEPTION 'Conecta tu wallet antes de retirar'; END IF;
IF p.withdraw_verified_at IS NULL THEN RAISE EXCEPTION 'Verifica tu wallet comprando 100 $DOGG para poder retirar.'; END IF;
IF p_amount IS NULL OR p_amount < 1000 THEN RAISE EXCEPTION 'El retiro mínimo es 1000 $DOGG'; END IF;
IF p.balance < p_amount THEN RAISE EXCEPTION 'Saldo insuficiente: necesitas % $DOGG', p_amount; END IF;
UPDATE public.dogg_players SET balance = balance - p_amount WHERE telegram_id=p_telegram_id;
INSERT INTO public.dogg_withdrawals(telegram_id, amount, fee, address) VALUES (p_telegram_id, p_amount - 70, 70, p.wallet_address) RETURNING id INTO wid;
RETURN wid;
END $function$;