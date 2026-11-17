CREATE TABLE public.dogg_smoke_rooms (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), host_id bigint NOT NULL, guest_id bigint,
 bet numeric NOT NULL CHECK (bet IN (10,25,50,100)), status text NOT NULL DEFAULT 'preparing' CHECK (status IN ('preparing','open','playing','won','draw','cancelled')),
 host_start timestamptz, guest_start timestamptz, host_duration integer, guest_duration integer,
 host_score integer, guest_score integer, winner_id bigint, payout numeric NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '30 minutes', ended_at timestamptz,
 CHECK (guest_id IS NULL OR guest_id <> host_id)
);
GRANT ALL ON public.dogg_smoke_rooms TO service_role;
ALTER TABLE public.dogg_smoke_rooms ENABLE ROW LEVEL SECURITY;
CREATE INDEX dogg_smoke_open ON public.dogg_smoke_rooms(expires_at) WHERE status IN ('preparing','open','playing');
CREATE INDEX dogg_smoke_host ON public.dogg_smoke_rooms(host_id,created_at DESC);
CREATE INDEX dogg_smoke_guest ON public.dogg_smoke_rooms(guest_id,created_at DESC);
CREATE INDEX dogg_smoke_history ON public.dogg_smoke_rooms(ended_at DESC) WHERE status IN ('won','draw');
CREATE OR REPLACE FUNCTION public.dogg_smoke_score(p_elapsed numeric,p_duration integer) RETURNS integer LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT CASE WHEN p_elapsed<0 OR p_elapsed>p_duration THEN 0 ELSE greatest(0,round(1000-abs(p_elapsed/p_duration-0.85)*2000)::integer) END $$;
REVOKE ALL ON FUNCTION public.dogg_smoke_score(numeric,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dogg_smoke_score(numeric,integer) TO service_role;
CREATE OR REPLACE FUNCTION public.dogg_smoke_expire() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r dogg_smoke_rooms; n integer:=0;
BEGIN
 PERFORM pg_advisory_xact_lock(4201701);
 FOR r IN SELECT * FROM dogg_smoke_rooms WHERE status IN ('preparing','open','playing') AND expires_at<=clock_timestamp() ORDER BY expires_at LIMIT 100 FOR UPDATE LOOP
  PERFORM telegram_id FROM dogg_players WHERE telegram_id IN (r.host_id,r.guest_id) ORDER BY telegram_id FOR UPDATE;
  UPDATE dogg_players SET balance=balance+r.bet WHERE telegram_id IN (r.host_id,r.guest_id);
  INSERT INTO dogg_ledger(telegram_id,kind,label,amount) VALUES(r.host_id,'game','hist.battleRefund',r.bet);
  IF r.guest_id IS NOT NULL THEN INSERT INTO dogg_ledger(telegram_id,kind,label,amount) VALUES(r.guest_id,'game','hist.battleRefund',r.bet); END IF;
  UPDATE dogg_smoke_rooms SET status='cancelled',ended_at=clock_timestamp() WHERE id=r.id;
  n:=n+1;
 END LOOP;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.dogg_smoke_expire() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dogg_smoke_expire() TO service_role;
CREATE OR REPLACE FUNCTION public.dogg_smoke(p_telegram_id bigint,p_action text,p_room uuid DEFAULT NULL,p_bet numeric DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pl dogg_players; other dogg_players; r dogg_smoke_rooms; rid uuid:=p_room; ishost boolean; ts timestamptz; dur integer; score integer; clk jsonb:=NULL; room jsonb; rooms jsonb;
BEGIN
 IF p_action IS NULL OR p_action NOT IN ('read','create','join','start','finish','cancel') THEN RAISE EXCEPTION 'Duelo no disponible'; END IF;
 PERFORM pg_advisory_xact_lock(4201701);
 PERFORM dogg_smoke_expire();
 SELECT * INTO pl FROM dogg_players WHERE telegram_id=p_telegram_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Jugador no encontrado'; END IF;
 IF pl.banned_at IS NOT NULL THEN RAISE EXCEPTION 'Cuenta suspendida'; END IF;
 IF pl.withdraw_verified_at IS NULL THEN RAISE EXCEPTION 'Verifica tu wallet para poder jugar'; END IF;
 IF p_action='create' THEN
  IF p_bet IS NULL OR p_bet NOT IN (10,25,50,100) THEN RAISE EXCEPTION 'Apuesta Smoke Battle no válida'; END IF;
  IF EXISTS(SELECT 1 FROM dogg_smoke_rooms WHERE status IN ('preparing','open','playing') AND p_telegram_id IN (host_id,guest_id)) THEN RAISE EXCEPTION 'Ya tienes una partida en curso'; END IF;
  IF pl.balance<p_bet THEN RAISE EXCEPTION 'Saldo insuficiente'; END IF;
  INSERT INTO dogg_smoke_rooms(host_id,bet) VALUES(p_telegram_id,p_bet) RETURNING * INTO r; rid:=r.id;
  UPDATE dogg_players SET balance=balance-p_bet WHERE telegram_id=p_telegram_id;
  INSERT INTO dogg_ledger(telegram_id,kind,label,amount) VALUES(p_telegram_id,'game','hist.battleBet',-p_bet);
 ELSIF p_action<>'read' THEN
  SELECT * INTO r FROM dogg_smoke_rooms WHERE id=p_room FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Duelo no disponible'; END IF;
  ishost:=r.host_id=p_telegram_id;
  IF p_action='join' THEN
   IF ishost OR r.status<>'open' OR r.guest_id IS NOT NULL OR r.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Duelo no disponible'; END IF;
   IF EXISTS(SELECT 1 FROM dogg_smoke_rooms WHERE status IN ('preparing','open','playing') AND p_telegram_id IN (host_id,guest_id)) THEN RAISE EXCEPTION 'Ya tienes una partida en curso'; END IF;
   SELECT * INTO other FROM dogg_players WHERE telegram_id=r.host_id FOR UPDATE;
   IF other.banned_at IS NOT NULL OR other.withdraw_verified_at IS NULL THEN RAISE EXCEPTION 'Duelo no disponible'; END IF;
   IF pl.balance<r.bet THEN RAISE EXCEPTION 'Saldo insuficiente'; END IF;
   UPDATE dogg_players SET balance=balance-r.bet WHERE telegram_id=p_telegram_id;
   INSERT INTO dogg_ledger(telegram_id,kind,label,amount) VALUES(p_telegram_id,'game','hist.battleBet',-r.bet);
   UPDATE dogg_smoke_rooms SET guest_id=p_telegram_id,status='playing',expires_at=clock_timestamp()+interval '60 seconds' WHERE id=r.id;
  ELSIF p_action='cancel' THEN
   IF NOT ishost OR r.status NOT IN ('preparing','open') THEN RAISE EXCEPTION 'Duelo no disponible'; END IF;
   UPDATE dogg_players SET balance=balance+r.bet WHERE telegram_id=p_telegram_id;
   INSERT INTO dogg_ledger(telegram_id,kind,label,amount) VALUES(p_telegram_id,'game','hist.battleRefund',r.bet);
   UPDATE dogg_smoke_rooms SET status='cancelled',ended_at=clock_timestamp() WHERE id=r.id;
  ELSE
   IF NOT ishost AND r.guest_id IS DISTINCT FROM p_telegram_id THEN RAISE EXCEPTION 'Duelo no disponible'; END IF;
   IF (ishost AND r.status<>'preparing') OR (NOT ishost AND r.status<>'playing') THEN RAISE EXCEPTION 'Duelo no disponible'; END IF;
   ts:=CASE WHEN ishost THEN r.host_start ELSE r.guest_start END;
   dur:=CASE WHEN ishost THEN r.host_duration ELSE r.guest_duration END;
   IF p_action='start' THEN
    IF ts IS NOT NULL THEN RAISE EXCEPTION 'La calada ya empezó'; END IF;
    dur:=4000+floor(random()*2001)::integer;
    ts:=clock_timestamp()+interval '1500 milliseconds';
    IF ishost THEN UPDATE dogg_smoke_rooms SET host_start=ts,host_duration=dur,expires_at=clock_timestamp()+interval '60 seconds' WHERE id=r.id;
    ELSE UPDATE dogg_smoke_rooms SET guest_start=ts,guest_duration=dur WHERE id=r.id; END IF;
    clk:=jsonb_build_object('now',extract(epoch from clock_timestamp())*1000,'start',extract(epoch from ts)*1000,'duration',dur);
   ELSE
    IF ts IS NULL OR dur IS NULL OR clock_timestamp()<ts THEN RAISE EXCEPTION 'La calada no está lista'; END IF;
    score:=dogg_smoke_score(extract(epoch from (clock_timestamp()-ts))*1000,dur);
    IF ishost THEN
     UPDATE dogg_smoke_rooms SET host_score=score,status='open',expires_at=clock_timestamp()+interval '30 minutes' WHERE id=r.id;
    ELSE
     PERFORM telegram_id FROM dogg_players WHERE telegram_id IN (r.host_id,r.guest_id) ORDER BY telegram_id FOR UPDATE;
     SELECT * INTO other FROM dogg_players WHERE telegram_id=r.host_id;
     IF other.banned_at IS NOT NULL OR other.withdraw_verified_at IS NULL THEN
      UPDATE dogg_players SET balance=balance+r.bet WHERE telegram_id IN (r.host_id,r.guest_id);
      INSERT INTO dogg_ledger(telegram_id,kind,label,amount) VALUES(r.host_id,'game','hist.battleRefund',r.bet),(r.guest_id,'game','hist.battleRefund',r.bet);
      UPDATE dogg_smoke_rooms SET guest_score=score,status='cancelled',ended_at=clock_timestamp() WHERE id=r.id;
     ELSIF score=r.host_score THEN
      UPDATE dogg_players SET balance=balance+r.bet WHERE telegram_id IN (r.host_id,r.guest_id);
      INSERT INTO dogg_ledger(telegram_id,kind,label,amount) VALUES(r.host_id,'game','hist.battleRefund',r.bet),(r.guest_id,'game','hist.battleRefund',r.bet);
      UPDATE dogg_smoke_rooms SET guest_score=score,status='draw',payout=r.bet,ended_at=clock_timestamp() WHERE id=r.id;
     ELSE
      r.winner_id:=CASE WHEN score>r.host_score THEN r.guest_id ELSE r.host_id END;
      r.payout:=floor(r.bet*2*0.95*100)/100;
      UPDATE dogg_players SET balance=balance+r.payout WHERE telegram_id=r.winner_id;
      INSERT INTO dogg_ledger(telegram_id,kind,label,amount) VALUES(r.winner_id,'game','hist.battleWin',r.payout);
      UPDATE dogg_smoke_rooms SET guest_score=score,winner_id=r.winner_id,payout=r.payout,status='won',ended_at=clock_timestamp() WHERE id=r.id;
     END IF;
    END IF;
   END IF;
  END IF;
 END IF;
 IF rid IS NULL THEN SELECT id INTO rid FROM dogg_smoke_rooms WHERE p_telegram_id IN (host_id,guest_id) ORDER BY (status IN ('preparing','open','playing')) DESC,created_at DESC LIMIT 1; END IF;
 SELECT jsonb_agg(v.dto ORDER BY v.created_at DESC) INTO rooms FROM (
 SELECT s.created_at,jsonb_build_object('id',s.id,'bet',s.bet,'status',s.status,'host_name',coalesce(nullif(h.first_name,''),'@'||h.username),'guest_name',coalesce(nullif(g.first_name,''),'@'||g.username),'expires_at',s.expires_at,
 'role',CASE WHEN s.host_id=p_telegram_id THEN 'host' WHEN s.guest_id=p_telegram_id THEN 'guest' ELSE 'visitor' END,
 'started',CASE WHEN s.host_id=p_telegram_id THEN s.host_start IS NOT NULL WHEN s.guest_id=p_telegram_id THEN s.guest_start IS NOT NULL ELSE false END,
 'submitted',CASE WHEN s.host_id=p_telegram_id THEN s.host_score IS NOT NULL WHEN s.guest_id=p_telegram_id THEN s.guest_score IS NOT NULL ELSE false END,
 'host_score',CASE WHEN s.status IN ('won','draw') THEN s.host_score END,'guest_score',CASE WHEN s.status IN ('won','draw') THEN s.guest_score END,
 'outcome',CASE WHEN s.status='draw' THEN 'draw' WHEN s.status='won' AND p_telegram_id IN (s.host_id,s.guest_id) THEN CASE WHEN s.winner_id=p_telegram_id THEN 'win' ELSE 'loss' END END,
 'payout',CASE WHEN s.status='draw' THEN s.bet WHEN s.winner_id=p_telegram_id THEN s.payout ELSE 0 END) dto
 FROM dogg_smoke_rooms s LEFT JOIN dogg_players h ON h.telegram_id=s.host_id LEFT JOIN dogg_players g ON g.telegram_id=s.guest_id
 WHERE s.id=rid OR (s.status='open' AND h.banned_at IS NULL AND h.withdraw_verified_at IS NOT NULL)
 ORDER BY (s.id=rid) DESC,s.created_at DESC LIMIT 21) v;
 SELECT x INTO room FROM jsonb_array_elements(coalesce(rooms,'[]'::jsonb)) x WHERE x->>'id'=rid::text LIMIT 1;
 SELECT balance INTO pl.balance FROM dogg_players WHERE telegram_id=p_telegram_id;
 RETURN jsonb_build_object('balance',pl.balance,'rooms',coalesce(rooms,'[]'::jsonb),'room',room,'clock',clk);
END $$;
REVOKE ALL ON FUNCTION public.dogg_smoke(bigint,text,uuid,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dogg_smoke(bigint,text,uuid,numeric) TO service_role;
CREATE VIEW public.dogg_smoke_public_history AS
 SELECT 'battle:'||s.id::text||':'||v.side AS id,'battle'::text AS game,s.bet,
 CASE WHEN s.status='draw' THEN s.bet WHEN s.winner_id=v.player THEN s.payout ELSE 0 END AS payout,s.ended_at AS played_at,
 coalesce(nullif(btrim(p.first_name),''),'@'||nullif(btrim(p.username),'')) AS player_name
 FROM public.dogg_smoke_rooms s CROSS JOIN LATERAL (VALUES(s.host_id,'host'),(s.guest_id,'guest')) v(player,side)
 LEFT JOIN public.dogg_players p ON p.telegram_id=v.player WHERE s.status IN ('won','draw') AND s.ended_at IS NOT NULL;
GRANT SELECT ON public.dogg_smoke_public_history TO anon,authenticated,service_role;
REVOKE ALL ON public.dogg_smoke_public_history FROM PUBLIC;
COMMENT ON VIEW public.dogg_smoke_public_history IS 'Public completed Smoke Battle results and display names only; no timing or Telegram IDs.';