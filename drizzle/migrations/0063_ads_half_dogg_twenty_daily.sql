DO $migration$
DECLARE fn regprocedure; definition text;
BEGIN
  FOREACH fn IN ARRAY ARRAY['public.dogg_ad(bigint,text,uuid)'::regprocedure, 'public.dogg_ad_postback(uuid,text,text,numeric,bigint)'::regprocedure] LOOP
    definition := pg_get_functiondef(fn);
    IF position('cnt >= 10' in definition) = 0 OR position('balance = balance + 5' in definition) = 0 THEN
      RAISE EXCEPTION 'Unexpected ad function definition: %', fn;
    END IF;
    definition := replace(definition, 'cnt >= 10', 'cnt >= 20');
    definition := replace(definition, 'balance = balance + 5', 'balance = balance + 0.5');
    definition := replace(definition, 'Ya viste los 10 anuncios', 'Ya viste los 20 anuncios');
    EXECUTE definition;
  END LOOP;
  definition := pg_get_functiondef('public.dogg_ledger_ads()'::regprocedure);
  IF position('''hist.ad'', 5,' in definition) = 0 THEN
    RAISE EXCEPTION 'Unexpected ad ledger function definition';
  END IF;
  EXECUTE replace(definition, '''hist.ad'', 5,', '''hist.ad'', 0.5,');
END;
$migration$;