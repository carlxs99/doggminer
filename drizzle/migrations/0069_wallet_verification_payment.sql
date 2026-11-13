CREATE TABLE public.dogg_verification_payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), telegram_id bigint NOT NULL REFERENCES public.dogg_players(telegram_id), wallet_address text NOT NULL, recipient text NOT NULL, memo text NOT NULL UNIQUE, amount_nano bigint NOT NULL DEFAULT 50000000 CHECK(amount_nano = 50000000), created_at timestamptz NOT NULL DEFAULT now(), confirmed_at timestamptz, tx_hash text UNIQUE,
 UNIQUE(telegram_id, wallet_address)
);
GRANT ALL ON public.dogg_verification_payments TO service_role;
ALTER TABLE public.dogg_verification_payments ENABLE ROW LEVEL SECURITY;
CREATE INDEX dogg_verification_pending ON public.dogg_verification_payments(created_at) WHERE confirmed_at IS NULL;
CREATE TABLE public.dogg_verification_cursor(recipient text PRIMARY KEY, last_lt text NOT NULL DEFAULT '0');
GRANT ALL ON public.dogg_verification_cursor TO service_role;
ALTER TABLE public.dogg_verification_cursor ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.dogg_open_verification(p_telegram_id bigint, p_recipient text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.dogg_players; v public.dogg_verification_payments;
BEGIN
SELECT * INTO p FROM public.dogg_players WHERE telegram_id=p_telegram_id FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'Abre de nuevo la mini app desde Telegram.'; END IF;
IF p.banned_at IS NOT NULL THEN RAISE EXCEPTION 'Cuenta suspendida'; END IF;
IF p.withdraw_verified_at IS NOT NULL THEN RETURN jsonb_build_object('verified',true); END IF;
IF p.wallet_address IS NULL THEN RAISE EXCEPTION 'Conecta y vincula tu wallet TON primero.'; END IF;
PERFORM pg_advisory_xact_lock(hashtextextended(p.wallet_address, 421));
IF EXISTS(SELECT 1 FROM public.dogg_players WHERE withdraw_verified_wallet=p.wallet_address AND telegram_id<>p_telegram_id) THEN RAISE EXCEPTION 'Esta wallet ya verificó otra cuenta de Telegram.'; END IF;
INSERT INTO public.dogg_verification_payments(telegram_id,wallet_address,recipient,memo) VALUES(p_telegram_id,p.wallet_address,p_recipient,'DOGG-VERIFY-'||gen_random_uuid()::text) ON CONFLICT(telegram_id,wallet_address) DO NOTHING;
SELECT * INTO v FROM public.dogg_verification_payments WHERE telegram_id=p_telegram_id AND wallet_address=p.wallet_address;
RETURN jsonb_build_object('verified',false,'memo',v.memo,'recipient',v.recipient,'amount',v.amount_nano::text,'wallet',v.wallet_address);
END $$;
CREATE OR REPLACE FUNCTION public.dogg_confirm_verification(p_memo text,p_sender text,p_recipient text,p_amount bigint,p_hash text,p_utime bigint) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.dogg_verification_payments; p public.dogg_players;
BEGIN
SELECT * INTO v FROM public.dogg_verification_payments WHERE memo=p_memo;
IF NOT FOUND THEN RETURN false; END IF;
SELECT * INTO p FROM public.dogg_players WHERE telegram_id=v.telegram_id FOR UPDATE;
PERFORM pg_advisory_xact_lock(hashtextextended(v.wallet_address,421));
SELECT * INTO v FROM public.dogg_verification_payments WHERE id=v.id FOR UPDATE;
IF v.confirmed_at IS NOT NULL THEN RETURN true; END IF;
IF p.banned_at IS NOT NULL OR p.wallet_address IS DISTINCT FROM v.wallet_address OR p_sender IS DISTINCT FROM v.wallet_address OR p_recipient IS DISTINCT FROM v.recipient OR coalesce(p_amount,0)<v.amount_nano OR p_hash IS NULL OR length(p_hash)<10 OR p_utime IS NULL OR to_timestamp(p_utime)<v.created_at THEN RETURN false; END IF;
IF EXISTS(SELECT 1 FROM public.dogg_players WHERE withdraw_verified_wallet=v.wallet_address AND telegram_id<>v.telegram_id) THEN RETURN false; END IF;
UPDATE public.dogg_verification_payments SET confirmed_at=now(),tx_hash=p_hash WHERE id=v.id;
IF p.withdraw_verified_at IS NULL THEN UPDATE public.dogg_players SET withdraw_verified_at=now(),withdraw_verified_wallet=v.wallet_address WHERE telegram_id=v.telegram_id; END IF;
RETURN true;
END $$;
CREATE OR REPLACE FUNCTION public.dogg_verify_withdraw(p_telegram_id bigint,p_wallet text,p_bought numeric) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF EXISTS(SELECT 1 FROM public.dogg_players WHERE telegram_id=p_telegram_id AND withdraw_verified_at IS NOT NULL) THEN RETURN true; END IF;
RAISE EXCEPTION 'Verifica tu wallet con el pago único de 0,05 GRAM para poder retirar.';
END $$;
COMMENT ON FUNCTION public.dogg_verify_withdraw(bigint,text,numeric) IS 'DEPRECATED: hold verification disabled; use server-confirmed unique-memo native payment.';
REVOKE ALL ON FUNCTION public.dogg_open_verification(bigint,text),public.dogg_confirm_verification(text,text,text,bigint,text,bigint),public.dogg_verify_withdraw(bigint,text,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dogg_open_verification(bigint,text),public.dogg_confirm_verification(text,text,text,bigint,text,bigint),public.dogg_verify_withdraw(bigint,text,numeric) TO service_role;