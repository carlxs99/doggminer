-- Disposable accounts; every row and ledger effect rolls back.
DO $$
DECLARE test_player bigint := -930000000001; y uuid; r jsonb; i integer; n numeric;
BEGIN
  BEGIN
    INSERT INTO public.dogg_players(telegram_id) VALUES(test_player);
    FOR i IN 1..20 LOOP
      r := public.dogg_ad(test_player, 'start');
      y := (r->>'ymid')::uuid;
      UPDATE public.dogg_ad_views SET created_at = now()-interval '10 seconds' WHERE ymid = y;
      r := public.dogg_ad(test_player, 'claim', y);
      IF (r->>'balance')::numeric <> i*0.5 OR (r->>'adsToday')::integer <> i THEN
        RAISE EXCEPTION 'Wrong reward or daily count at ad %', i;
      END IF;
      r := public.dogg_ad(test_player, 'claim', y);
      IF (r->>'balance')::numeric <> i*0.5 THEN RAISE EXCEPTION 'Duplicate claim paid'; END IF;
      IF public.dogg_ad_postback(y,'reward','valued',0.01,test_player) <> 'duplicate' THEN RAISE EXCEPTION 'Duplicate postback paid'; END IF;
    END LOOP;
    SELECT sum(amount) INTO n FROM public.dogg_ledger WHERE telegram_id=test_player AND label='hist.ad';
    IF n IS DISTINCT FROM 10::numeric THEN RAISE EXCEPTION 'Ledger must total 10 DOGG'; END IF;
    BEGIN
      PERFORM public.dogg_ad(test_player, 'start');
      RAISE EXCEPTION '21st ad allowed';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Ya viste los 20 anuncios%' THEN RAISE; END IF;
    END;
    INSERT INTO public.dogg_ad_views(telegram_id,created_at) VALUES(test_player,now()-interval '10 seconds') RETURNING ymid INTO y;
    r:=public.dogg_ad(test_player,'claim',y);
    IF r->>'status' <> 'capped' OR (r->>'balance')::numeric <> 10 THEN RAISE EXCEPTION 'Claim cap failed'; END IF;
    INSERT INTO public.dogg_ad_views(telegram_id) VALUES(test_player) RETURNING ymid INTO y;
    IF public.dogg_ad_postback(y,'reward','valued',0.01,test_player) <> 'capped' THEN RAISE EXCEPTION 'Postback cap failed'; END IF;
    UPDATE public.dogg_players SET ad_day=(now() AT TIME ZONE 'utc')::date-1 WHERE telegram_id=test_player;
    r:=public.dogg_ad(test_player,'start');
    y:=(r->>'ymid')::uuid;
    IF (r->>'adsToday')::integer <> 0 THEN RAISE EXCEPTION 'UTC day reset failed'; END IF;
    IF public.dogg_ad_postback(y,'reward','valued',0.01,test_player) <> 'paid' THEN RAISE EXCEPTION 'Postback reward failed'; END IF;
    SELECT balance INTO n FROM public.dogg_players WHERE telegram_id=test_player;
    IF n IS DISTINCT FROM 10.5::numeric THEN RAISE EXCEPTION 'Postback must pay 0.5'; END IF;
    RAISE EXCEPTION 'ads_test_rollback_success';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ads_test_rollback_success' THEN RAISE; END IF;
  END;
END;
$$;