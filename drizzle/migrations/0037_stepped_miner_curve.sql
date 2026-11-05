CREATE OR REPLACE FUNCTION public.dogg_miner_stats(p_id text, OUT daily numeric, OUT hold numeric)
LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $$
DECLARE n int; i int; t int; j int; k int; d float8;
  jumps float8[] := ARRAY[1.12,1.15,1.18,1.22,1.26,1.3,1.35,1.4,1.5];
  holds float8[] := ARRAY[10,150,500,1200,2500,5000,10000,20000,40000,80000,150000];
BEGIN
-- Stepped curve (mirrors src/lib/mining.ts minerAt): +0.4% per level inside a tier, growing jump at each new tier.
SELECT v.d,v.h INTO daily,hold FROM (VALUES ('rookie-1',5::numeric,0::numeric),('rookie-2',6,10),('rookie-3',6.75,100),('rookie-4',7.5,1000),('og-grower',25,10000),('lowrider',50,50000),('magma',125,100000),('kingpin',250,250000)) v(id,d,h) WHERE v.id=p_id;
IF daily IS NOT NULL THEN RETURN; END IF;
IF p_id ~ '^miner-[0-9]{1,3}$' THEN
  n:=substring(p_id from 7)::int;
  IF n BETWEEN 2 AND 500 THEN
    i:=n-1; t:=i/50; j:=i%50; d:=5;
    FOR k IN 1..t LOOP d:=d*power(1.004::float8,49)*jumps[k]; END LOOP;
    daily:=round((d*power(1.004::float8,j))::numeric,2);
    IF t=0 THEN hold:=round(holds[1]*power(holds[2]/holds[1],(j-1)::float8/49))::numeric;
    ELSE hold:=round(holds[t+1]*power(holds[t+2]/holds[t+1],j::float8/50))::numeric; END IF;
  END IF;
END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.dogg_best_miner(p_total numeric)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $f$
DECLARE n int; best int := 1;
BEGIN
FOR n IN 2..500 LOOP
  IF (public.dogg_miner_stats('miner-'||n)).hold <= p_total THEN best:=n; ELSE EXIT; END IF;
END LOOP;
IF best < 2 THEN RETURN 'rookie-1'; END IF;
RETURN 'miner-'||best;
END; $f$;
REVOKE EXECUTE ON FUNCTION public.dogg_best_miner(numeric) FROM PUBLIC, anon, authenticated;