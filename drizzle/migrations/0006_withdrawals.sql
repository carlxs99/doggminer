CREATE TABLE public.dogg_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id bigint NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  fee numeric NOT NULL DEFAULT 70,
  address text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','failed')),
  seqno integer,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
GRANT ALL ON public.dogg_withdrawals TO service_role;
ALTER TABLE public.dogg_withdrawals ENABLE ROW LEVEL SECURITY;
CREATE INDEX dogg_withdrawals_tg ON public.dogg_withdrawals(telegram_id, created_at DESC);

CREATE TABLE public.dogg_payout_lock (id int PRIMARY KEY, locked_until timestamptz NOT NULL DEFAULT 'epoch');
GRANT ALL ON public.dogg_payout_lock TO service_role;
ALTER TABLE public.dogg_payout_lock ENABLE ROW LEVEL SECURITY;
INSERT INTO public.dogg_payout_lock(id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.dogg_withdraw(p_telegram_id bigint, p_amount numeric)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE p public.dogg_players; wid uuid;
BEGIN
SELECT * INTO p FROM public.dogg_players WHERE telegram_id=p_telegram_id FOR UPDATE;
IF p IS NULL OR p.wallet_address IS NULL THEN RAISE EXCEPTION 'Conecta tu wallet antes de retirar'; END IF;
IF p_amount < 1000 THEN RAISE EXCEPTION 'El retiro mínimo es 1000 $DOGG'; END IF;
IF p.balance < p_amount + 70 THEN RAISE EXCEPTION 'Saldo insuficiente: necesitas % $DOGG (incluye 70 de comisión)', p_amount + 70; END IF;
UPDATE public.dogg_players SET balance = balance - p_amount - 70 WHERE telegram_id=p_telegram_id;
INSERT INTO public.dogg_withdrawals(telegram_id, amount, address) VALUES (p_telegram_id, p_amount, p.wallet_address) RETURNING id INTO wid;
RETURN wid;
END $$;

CREATE OR REPLACE FUNCTION public.dogg_withdraw_fail(p_id uuid, p_error text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE w public.dogg_withdrawals;
BEGIN
SELECT * INTO w FROM public.dogg_withdrawals WHERE id=p_id FOR UPDATE;
IF w IS NULL OR w.status IN ('sent','failed') THEN RETURN; END IF;
UPDATE public.dogg_withdrawals SET status='failed', error=left(p_error,500) WHERE id=p_id;
UPDATE public.dogg_players SET balance = balance + w.amount + w.fee WHERE telegram_id=w.telegram_id;
END $$;

CREATE OR REPLACE FUNCTION public.dogg_payout_acquire()
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH u AS (UPDATE public.dogg_payout_lock SET locked_until = now() + interval '40 seconds' WHERE id=1 AND locked_until < now() RETURNING 1)
  SELECT EXISTS (SELECT 1 FROM u);
$$;
CREATE OR REPLACE FUNCTION public.dogg_payout_release()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$ UPDATE public.dogg_payout_lock SET locked_until='epoch' WHERE id=1; $$;

REVOKE EXECUTE ON FUNCTION public.dogg_withdraw(bigint,numeric), public.dogg_withdraw_fail(uuid,text), public.dogg_payout_acquire(), public.dogg_payout_release() FROM PUBLIC, anon, authenticated;