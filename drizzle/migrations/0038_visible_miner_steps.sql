CREATE OR REPLACE FUNCTION public.dogg_miner_stats(p_id text, OUT daily numeric, OUT hold numeric)
LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $$
DECLARE n int; i int; t int; j int; r float8;
  holds float8[] := ARRAY[3,150,500,1200,2500,5000,10000,20000,40000,80000,150000];
BEGIN
-- Visible steps (mirrors src/lib/mining.ts minerAt): +0.25/day per level at the start growing to +1.20 at level 500; hold strictly rising.
SELECT v.d,v.h INTO daily,hold FROM (VALUES ('rookie-1',5::numeric,0::numeric),('rookie-2',6,10),('rookie-3',6.75,100),('rookie-4',7.5,1000),('og-grower',25,10000),('lowrider',50,50000),('magma',125,100000),('kingpin',250,250000)) v(id,d,h) WHERE v.id=p_id;
IF daily IS NOT NULL THEN RETURN; END IF;
IF p_id ~ '^miner-[0-9]{1,3}$' THEN
  n:=substring(p_id from 7)::int;
  IF n BETWEEN 2 AND 500 THEN
    i:=n-1; t:=i/50; j:=i%50;
    daily:=round((5+0.25*i+(174.25/power(499::float8,2.72))*power(i::float8,2.72))::numeric,2);
    IF t=0 THEN r:=holds[1]*power(holds[2]/holds[1],(j-1)::float8/49);
    ELSE r:=holds[t+1]*power(holds[t+2]/holds[t+1],j::float8/50); END IF;
    hold:=greatest(round(r::numeric), n+1);
  END IF;
END IF;
END; $$;