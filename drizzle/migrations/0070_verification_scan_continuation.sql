ALTER TABLE public.dogg_verification_cursor ADD COLUMN page_lt text, ADD COLUMN page_hash text, ADD COLUMN head_lt text;
CREATE OR REPLACE FUNCTION public.dogg_withdraw(p_telegram_id bigint,p_amount numeric) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.dogg_players; wid uuid; f numeric;
BEGIN
SELECT * INTO p FROM public.dogg_players WHERE telegram_id=p_telegram_id FOR UPDATE;
IF p IS NULL OR p.wallet_address IS NULL THEN RAISE EXCEPTION 'Conecta tu wallet antes de retirar'; END IF;
IF p.withdraw_verified_at IS NULL THEN RAISE EXCEPTION 'Verifica tu wallet con el pago único de 0,05 GRAM para poder retirar.'; END IF;
IF p_amount IS NULL OR p_amount<1000 THEN RAISE EXCEPTION 'El retiro mínimo es 1000 $DOGG'; END IF;
IF p.balance<p_amount THEN RAISE EXCEPTION 'Saldo insuficiente: necesitas % $DOGG',p_amount; END IF;
f:=CASE WHEN p.lp_active THEN 0 ELSE 70 END;
UPDATE public.dogg_players SET balance=balance-p_amount WHERE telegram_id=p_telegram_id;
INSERT INTO public.dogg_withdrawals(telegram_id,amount,fee,address) VALUES(p_telegram_id,p_amount-f,f,p.wallet_address) RETURNING id INTO wid;
RETURN wid;
END $$;