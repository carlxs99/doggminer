-- Run with the database write tool. Every disposable row and side effect rolls back inside the subtransaction.
DO $$
DECLARE id bigint := -940000000001; id2 bigint := -940000000002;
        wA text := '0:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
        wB text := '0:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
        wC text := '0:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';
        wE text := '0:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
BEGIN
 BEGIN
  -- A player verified wallet A (paid the one-time fee) and is a liquidity partner with it.
  INSERT INTO dogg_players(telegram_id,balance,wallet_address,withdraw_verified_at,withdraw_verified_wallet,lp_active,lp_ton)
    VALUES(id,1500,wA,now(),wA,true,3);
  INSERT INTO dogg_verification_payments(telegram_id,wallet_address,recipient,memo,confirmed_at)
    VALUES(id,wA,'-1:0','DOGG-TEST-A',now()-interval '1 hour');
  -- 1) Switching to a new wallet revokes that wallet's verification and its liquidity status.
  UPDATE dogg_players SET wallet_address=wB WHERE telegram_id=id;
  IF EXISTS(SELECT 1 FROM dogg_players WHERE telegram_id=id
      AND (withdraw_verified_at IS NOT NULL OR withdraw_verified_wallet IS NOT NULL OR withdraw_verified_amount IS NOT NULL OR lp_active)) THEN
    RAISE EXCEPTION 'A new wallet must start unverified and without liquidity status';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM dogg_players WHERE telegram_id=id AND balance=1500) THEN
    RAISE EXCEPTION 'Changing wallet must not touch the balance';
  END IF;
  -- 2) The same account's already paid wallet comes back without paying again.
  UPDATE dogg_players SET wallet_address=wA WHERE telegram_id=id;
  IF NOT EXISTS(SELECT 1 FROM dogg_players WHERE telegram_id=id AND withdraw_verified_at IS NOT NULL
      AND withdraw_verified_wallet=wA AND NOT lp_active) THEN
    RAISE EXCEPTION 'An already verified wallet must come back automatically';
  END IF;
  -- 3) Unlinking without changing wallet keeps the verification.
  UPDATE dogg_players SET wallet_address=NULL WHERE telegram_id=id;
  IF NOT EXISTS(SELECT 1 FROM dogg_players WHERE telegram_id=id AND withdraw_verified_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Unlinking must keep the verification';
  END IF;
  -- 4) A wallet this account never paid for stays unverified.
  UPDATE dogg_players SET wallet_address=wB WHERE telegram_id=id;
  IF EXISTS(SELECT 1 FROM dogg_players WHERE telegram_id=id AND withdraw_verified_at IS NOT NULL) THEN
    RAISE EXCEPTION 'A wallet never paid for must stay unverified';
  END IF;
  -- 5) A wallet another account already claimed is not restored by relinking it.
  INSERT INTO dogg_players(telegram_id,balance,wallet_address,withdraw_verified_at,withdraw_verified_wallet)
    VALUES(id2,10,wC,now(),wA);
  UPDATE dogg_players SET wallet_address=wA WHERE telegram_id=id;
  IF EXISTS(SELECT 1 FROM dogg_players WHERE telegram_id=id AND withdraw_verified_at IS NOT NULL) THEN
    RAISE EXCEPTION 'A wallet claimed by another account must not restore verification';
  END IF;
  -- 6) A suspended account keeps its verification record when its wallet changes (the ban guard owns those rows).
  UPDATE dogg_players SET banned_at=now(),ban_reason='test' WHERE telegram_id=id2;
  UPDATE dogg_players SET wallet_address=wE WHERE telegram_id=id2;
  IF NOT EXISTS(SELECT 1 FROM dogg_players WHERE telegram_id=id2 AND withdraw_verified_at IS NOT NULL AND withdraw_verified_wallet=wA) THEN
    RAISE EXCEPTION 'A suspended account must not lose its verification record on a wallet change';
  END IF;
  RAISE SQLSTATE 'ZX001' USING MESSAGE='All wallet-change checks passed; discard disposable data';
 EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
 END;
END $$;
