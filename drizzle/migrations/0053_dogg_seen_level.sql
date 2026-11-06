CREATE TABLE public.dogg_seen_levels (telegram_id bigint PRIMARY KEY, level int NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.dogg_seen_levels TO service_role;
ALTER TABLE public.dogg_seen_levels ENABLE ROW LEVEL SECURITY;
-- Returns the previously announced level (0 if none) and stores the new one atomically, so each rank up is announced once per account across devices.
CREATE OR REPLACE FUNCTION public.dogg_mark_level(p_id bigint, p_level int) RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE prev int;
BEGIN
  SELECT level INTO prev FROM dogg_seen_levels WHERE telegram_id = p_id FOR UPDATE;
  INSERT INTO dogg_seen_levels(telegram_id, level) VALUES (p_id, p_level)
    ON CONFLICT (telegram_id) DO UPDATE SET level = EXCLUDED.level, updated_at = now();
  RETURN coalesce(prev, 0);
END $$;
REVOKE ALL ON FUNCTION public.dogg_mark_level(bigint, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dogg_mark_level(bigint, int) TO service_role;