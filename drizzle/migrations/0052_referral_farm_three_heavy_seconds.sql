DO $$ DECLARE src text; BEGIN
  SELECT pg_get_functiondef('public.dogg_register(bigint,bigint,text,text)'::regprocedure) INTO src;
  src := replace(src, 'heavy_secs >= 5', 'heavy_secs >= 3');
  src := replace(src, 'at least 5 seconds', 'at least 3 seconds');
  EXECUTE src;
END $$;