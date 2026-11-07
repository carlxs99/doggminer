DO $$ DECLARE src text; BEGIN
  SELECT pg_get_functiondef('public.dogg_register(bigint,bigint,text,text)'::regprocedure) INTO src;
  src := replace(src, 'IF r30 >= 60 AND bot30 >= 0.95 * r30', 'IF r30 >= 100 AND bot30 >= 0.95 * r30');
  src := replace(src, '>=60 recruits in 30 min', '>=100 recruits in 30 min (60 caught airdrop channels with some real players)');
  EXECUTE src;
END $$;