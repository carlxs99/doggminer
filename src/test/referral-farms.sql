-- Run with the database write tool. Every disposable row and side effect rolls back inside the subtransaction.
DO $$
DECLARE r jsonb; wid uuid; result jsonb; id bigint:= -920000000001; i int;
BEGIN
 BEGIN
  INSERT INTO dogg_players(telegram_id,balance,created_at,wallet_address,withdraw_verified_at)
  VALUES(id,3000,now()-interval '2 days','disposable-farm-wallet',now());
  INSERT INTO dogg_players(telegram_id,referred_by,created_at,referral_qualified_at)
  SELECT id-i,id,now()-i*interval '41 seconds',now()-i*interval '41 seconds'+interval '25 seconds' FROM generate_series(1,199) i;
  r:=dogg_referral_farm_check(id);
  IF (r->>'banned')::boolean THEN RAISE EXCEPTION '199 recruits must not auto-ban'; END IF;
  wid:=dogg_withdraw(id,1000);
  INSERT INTO dogg_players(telegram_id,referred_by,created_at) VALUES(id-200,id,now()-interval '8200 seconds');
  UPDATE dogg_players SET referral_qualified_at=created_at+interval '25 seconds' WHERE telegram_id=id-200;
  IF NOT EXISTS(SELECT 1 FROM dogg_players WHERE telegram_id=id AND banned_at IS NOT NULL AND balance=3000) THEN RAISE EXCEPTION '200th qualification must ban with pending withdrawal refunded'; END IF;
  IF NOT EXISTS(SELECT 1 FROM dogg_withdrawals w WHERE w.id=wid AND status='failed') THEN RAISE EXCEPTION 'Unsent payout not cancelled'; END IF;
  BEGIN
   PERFORM dogg_shift(id,'start',0);
   RAISE EXCEPTION 'Banned start succeeded';
  EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT LIKE '%Cuenta suspendida%' THEN RAISE; END IF;
  END;
  INSERT INTO dogg_admins(telegram_id) VALUES(id-1000);
  PERFORM dogg_admin_set_ban(id-1000,id,false);
  r:=dogg_referral_farm_check(id);
  IF (r->>'banned')::boolean THEN RAISE EXCEPTION 'Manual exemption lost'; END IF;
  -- A viral promoter with the same volume and rapid first starts but irregular arrivals is not a farm.
  INSERT INTO dogg_players(telegram_id,created_at) VALUES(id-2000,now()-interval '2 days');
  INSERT INTO dogg_players(telegram_id,referred_by,created_at,referral_qualified_at)
  SELECT id-2000-i,id-2000,now()-i*i*interval '1 second',now()-i*i*interval '1 second'+interval '25 seconds' FROM generate_series(1,200) i;
  r:=dogg_referral_farm_check(id-2000);
  IF (r->>'banned')::boolean THEN RAISE EXCEPTION 'Popular promoter false positive'; END IF;
  -- Regular arrivals without a fixed first-start delay also remain unbanned.
  INSERT INTO dogg_players(telegram_id,created_at) VALUES(id-3000,now()-interval '2 days');
  INSERT INTO dogg_players(telegram_id,referred_by,created_at,referral_qualified_at)
  SELECT id-3000-i,id-3000,now()-i*interval '41 seconds',now()-i*interval '41 seconds'+(5+i%50)*interval '1 second' FROM generate_series(1,200) i;
  r:=dogg_referral_farm_check(id-3000);
  IF (r->>'banned')::boolean THEN RAISE EXCEPTION 'Cadence-only false positive'; END IF;
  -- Admins cannot be auto-banned.
  INSERT INTO dogg_admins(telegram_id) VALUES(id-3000);
  UPDATE dogg_players SET referral_qualified_at=created_at+interval '25 seconds' WHERE referred_by=id-3000;
  r:=dogg_referral_farm_check(id-3000);
  IF (r->>'banned')::boolean THEN RAISE EXCEPTION 'Admin exemption lost'; END IF;
  RAISE SQLSTATE 'ZX001' USING MESSAGE='All farm checks passed; discard disposable data';
 EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
 END;
END $$;