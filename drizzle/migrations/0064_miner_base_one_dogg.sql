CREATE OR REPLACE FUNCTION public.dogg_miner_stats(p_id text, OUT daily numeric, OUT hold numeric)
 RETURNS record
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE n int; i int; t int; j int; r float8;
  holds float8[] := ARRAY[10,400,1500,4000,8000,15000,40000,80000,150000,300000,600000];
BEGIN
-- Mirrors src/lib/mining.ts minerAt: level 1 = 1/day, gentle start (+0.10/level), level 500 = 304/day.
SELECT v.d,v.h INTO daily,hold FROM (VALUES ('rookie-1',1::numeric,0::numeric),('rookie-2',6,10),('rookie-3',6.75,100),('rookie-4',7.5,1000),('og-grower',25,10000),('lowrider',50,50000),('magma',125,100000),('kingpin',250,250000)) v(id,d,h) WHERE v.id=p_id;
IF daily IS NOT NULL THEN RETURN; END IF;
IF p_id ~ '^miner-[0-9]{1,3}$' THEN
  n:=substring(p_id from 7)::int;
  IF n BETWEEN 2 AND 500 THEN
    i:=n-1; t:=i/50; j:=i%50;
    daily:=round((1+0.10*i+(253.1/power(499::float8,2.85))*power(i::float8,2.85))::numeric,2);
    IF t=0 THEN r:=holds[1]*power(holds[2]/holds[1],(j-1)::float8/49);
    ELSE r:=holds[t+1]*power(holds[t+2]/holds[t+1],j::float8/50); END IF;
    hold:=greatest(round(r::numeric), n+8);
  END IF;
END IF;
END; $function$;