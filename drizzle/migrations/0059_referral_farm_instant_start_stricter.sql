DO $$ DECLARE src text; BEGIN
  SELECT pg_get_functiondef('public.dogg_register(bigint,bigint,text,text)'::regprocedure) INTO src;
  src := replace(src, 'IF r30 >= 40 AND bot30 >= 0.9 * r30', 'IF r30 >= 60 AND bot30 >= 0.95 * r30');
  src := replace(src, '>=40 recruits in 30 min', '>=60 recruits in 30 min');
  src := replace(src, '>=90% of them started', '>=95% of them started');
  EXECUTE src;
END $$;