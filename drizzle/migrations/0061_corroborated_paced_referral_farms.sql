CREATE OR REPLACE FUNCTION public.dogg_referral_farm_check(p_referrer bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n int; timed int; gaps int; paced int; center int; evidence jsonb; newly bigint[];
BEGIN
 IF NOT EXISTS (SELECT 1 FROM dogg_players WHERE telegram_id=p_referrer AND banned_at IS NULL AND NOT ban_exempt)
 OR EXISTS(SELECT 1 FROM dogg_admins WHERE telegram_id=p_referrer) THEN RETURN jsonb_build_object('banned',false); END IF;
 -- Two independent machine signatures are required: near-identical first-start latency AND regular registration cadence.
 -- Sample bounded to the latest 200 recruits in 24h; volume, names, IP/model and inactivity alone never ban.
 WITH sample AS MATERIALIZED (SELECT created_at,referral_qualified_at FROM dogg_players WHERE referred_by=p_referrer AND created_at>now()-interval '24 hours' ORDER BY created_at DESC LIMIT 200), modes AS (
 SELECT round(extract(epoch FROM referral_qualified_at-created_at))::int d,count(*) c FROM sample
 WHERE referral_qualified_at>=created_at AND referral_qualified_at<=created_at+interval '60 seconds' GROUP BY 1)
 SELECT d INTO center FROM modes ORDER BY c DESC,d LIMIT 1;
 WITH sample AS MATERIALIZED (SELECT created_at,referral_qualified_at FROM dogg_players WHERE referred_by=p_referrer AND created_at>now()-interval '24 hours' ORDER BY created_at DESC LIMIT 200), rows AS (
 SELECT extract(epoch FROM referral_qualified_at-created_at) d,extract(epoch FROM created_at-lag(created_at) OVER(ORDER BY created_at)) g FROM sample), modes AS (
 SELECT round(g)::int spacing,count(*) c FROM rows WHERE g BETWEEN 10 AND 180 GROUP BY 1), mode AS (SELECT spacing FROM modes ORDER BY c DESC,spacing LIMIT 1)
 SELECT count(*),count(*) FILTER(WHERE d BETWEEN center-1 AND center+1),count(g),count(*) FILTER(WHERE g BETWEEN (SELECT spacing FROM mode)-2 AND (SELECT spacing FROM mode)+2)
 INTO n,timed,gaps,paced FROM rows;
 evidence:=jsonb_build_object('rule','fixed_start_and_paced_registration','sample',n,'fixed_start',timed,'start_seconds',center,'gaps',gaps,'paced',paced);
 IF n>=200 AND timed>=0.95*n AND paced>=0.5*gaps THEN
   newly:=dogg_ban_group(ARRAY[p_referrer]);
   IF cardinality(newly)>0 THEN
     UPDATE dogg_players SET ban_reason='referral_farm' WHERE telegram_id=p_referrer;
     INSERT INTO dogg_admin_log(admin_id,action,details) VALUES(0,'auto_ban_referral_farm',evidence||jsonb_build_object('telegram_id',p_referrer));
   END IF;
   RETURN evidence||jsonb_build_object('banned',true);
 END IF;
 RETURN evidence||jsonb_build_object('banned',false);
END $$;
REVOKE ALL ON FUNCTION public.dogg_referral_farm_check(bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dogg_referral_farm_check(bigint) TO service_role;
CREATE OR REPLACE FUNCTION public.dogg_check_first_qualification() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
 IF NEW.referral_qualified_at IS NOT NULL AND OLD.referral_qualified_at IS NULL AND NEW.referred_by IS NOT NULL THEN
   PERFORM dogg_referral_farm_check(NEW.referred_by);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.dogg_check_first_qualification() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER dogg_check_first_qualification AFTER UPDATE OF referral_qualified_at ON public.dogg_players FOR EACH ROW EXECUTE FUNCTION public.dogg_check_first_qualification();
CREATE OR REPLACE FUNCTION public.dogg_register(p_telegram_id bigint,p_referrer bigint,p_first_name text,p_username text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE inserted boolean;
BEGIN
 INSERT INTO dogg_players(telegram_id,first_name,username) VALUES(p_telegram_id,left(p_first_name,64),left(p_username,64)) ON CONFLICT DO NOTHING;
 inserted:=FOUND;
 IF NOT inserted THEN
   UPDATE dogg_players SET first_name=left(p_first_name,64),username=left(p_username,64) WHERE telegram_id=p_telegram_id;
   RETURN;
 END IF;
 IF p_referrer IS NOT NULL AND p_referrer<>p_telegram_id THEN
   UPDATE dogg_players me SET referred_by=p_referrer WHERE me.telegram_id=p_telegram_id
   AND EXISTS(SELECT 1 FROM dogg_players r WHERE r.telegram_id=p_referrer AND r.created_at<me.created_at);
 END IF;
 -- No raw-volume or fast-start-only bans: viral channels may generate both. Qualification checks corroborated cadence.
END $$;
CREATE OR REPLACE FUNCTION public.dogg_guard_payout_attempt() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
 IF NEW.status='sending' AND OLD.status='pending' AND EXISTS(SELECT 1 FROM dogg_players WHERE telegram_id=NEW.telegram_id AND banned_at IS NOT NULL) THEN
   RAISE EXCEPTION 'Cuenta suspendida por multicuentas.';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.dogg_guard_payout_attempt() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER dogg_guard_payout_attempt BEFORE UPDATE OF status ON public.dogg_withdrawals FOR EACH ROW EXECUTE FUNCTION public.dogg_guard_payout_attempt();