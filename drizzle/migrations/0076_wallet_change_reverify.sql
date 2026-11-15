-- Changing the linked wallet revokes the previous wallet's verification: the new wallet must be verified again.
CREATE OR REPLACE FUNCTION public.dogg_wallet_change_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v public.dogg_verification_payments;
BEGIN
  IF NEW.banned_at IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.wallet_address IS DISTINCT FROM OLD.wallet_address AND NEW.wallet_address IS NOT NULL THEN
    -- Liquidity-partner status belongs to the wallet: it is re-read on-chain for the new one.
    NEW.lp_active := false; NEW.lp_ton := NULL; NEW.lp_at := NULL;
    IF OLD.withdraw_verified_wallet IS DISTINCT FROM NEW.wallet_address THEN
      -- A wallet this same account already paid to verify comes back automatically, unless another account claimed it.
      SELECT * INTO v FROM public.dogg_verification_payments
        WHERE telegram_id = NEW.telegram_id AND wallet_address = NEW.wallet_address AND confirmed_at IS NOT NULL;
      IF FOUND AND NOT EXISTS (SELECT 1 FROM public.dogg_players x
            WHERE x.withdraw_verified_wallet = NEW.wallet_address AND x.telegram_id <> NEW.telegram_id) THEN
        NEW.withdraw_verified_at := v.confirmed_at;
        NEW.withdraw_verified_wallet := NEW.wallet_address;
      ELSE
        NEW.withdraw_verified_at := NULL;
        NEW.withdraw_verified_wallet := NULL;
        NEW.withdraw_verified_amount := NULL;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS dogg_wallet_change_guard ON public.dogg_players;
CREATE TRIGGER dogg_wallet_change_guard BEFORE UPDATE ON public.dogg_players FOR EACH ROW EXECUTE FUNCTION public.dogg_wallet_change_guard();