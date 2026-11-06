CREATE OR REPLACE FUNCTION public.dogg_task_start(p_telegram_id bigint, p_task uuid) RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.dogg_tasks; started timestamptz;
BEGIN
  SELECT * INTO t FROM public.dogg_tasks WHERE id = p_task AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Esta tarea ya no está disponible.'; END IF;
  INSERT INTO public.dogg_players (telegram_id) VALUES (p_telegram_id) ON CONFLICT DO NOTHING;
  INSERT INTO public.dogg_task_claims (task_id, telegram_id) VALUES (p_task, p_telegram_id) ON CONFLICT DO NOTHING;
  IF t.kind = 'react' THEN
    -- Each round starts when the player opens the channel today.
    UPDATE public.dogg_task_claims SET started_at = now(), claimed_at = NULL, reward = NULL
      WHERE task_id = p_task AND telegram_id = p_telegram_id
        AND (claimed_at IS NULL OR now() >= claimed_at + interval '24 hours');
  END IF;
  SELECT started_at INTO started FROM public.dogg_task_claims WHERE task_id = p_task AND telegram_id = p_telegram_id;
  RETURN started;
END; $$;

CREATE OR REPLACE FUNCTION public.dogg_task_claim(p_telegram_id bigint, p_task uuid, p_member boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.dogg_tasks; c public.dogg_task_claims; bal numeric;
BEGIN
  SELECT * INTO t FROM public.dogg_tasks WHERE id = p_task AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Esta tarea ya no está disponible.'; END IF;
  SELECT * INTO c FROM public.dogg_task_claims WHERE task_id = p_task AND telegram_id = p_telegram_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Primero abre la tarea.'; END IF;
  IF c.claimed_at IS NOT NULL AND t.kind = 'react' THEN RAISE EXCEPTION 'Ya hiciste esta tarea hoy. Vuelve cuando se reinicie.'; END IF;
  IF c.claimed_at IS NOT NULL THEN RAISE EXCEPTION 'Ya cobraste esta tarea.'; END IF;
  IF t.kind = 'react' AND now() > c.started_at + interval '1 hour' THEN RAISE EXCEPTION 'Primero abre la tarea.'; END IF;
  IF t.kind = 'bot' AND now() < c.started_at + interval '10 seconds' THEN RAISE EXCEPTION 'Espera 10 segundos con el bot abierto antes de reclamar.'; END IF;
  IF t.kind = 'react' AND now() < c.started_at + interval '10 seconds' THEN RAISE EXCEPTION 'Espera 10 segundos en el canal antes de reclamar.'; END IF;
  IF t.kind IN ('channel', 'group', 'react') AND NOT coalesce(p_member, false) THEN RAISE EXCEPTION 'Aún no te vemos dentro. Únete y vuelve a verificar.'; END IF;
  UPDATE public.dogg_task_claims SET claimed_at = now(), reward = t.reward WHERE task_id = p_task AND telegram_id = p_telegram_id;
  UPDATE public.dogg_tasks SET claims = claims + 1 WHERE id = p_task;
  UPDATE public.dogg_players SET balance = balance + t.reward WHERE telegram_id = p_telegram_id RETURNING balance INTO bal;
  RETURN jsonb_build_object('balance', bal, 'reward', t.reward);
END; $$;