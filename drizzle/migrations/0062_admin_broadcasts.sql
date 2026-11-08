CREATE TABLE public.dogg_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text text NOT NULL,
  photo_file_id text,
  button_text text,
  button_url text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sending','done','cancelled')),
  cursor_id bigint NOT NULL DEFAULT 0,
  sent integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  gone integer NOT NULL DEFAULT 0,
  lease_until timestamptz NOT NULL DEFAULT '1970-01-01',
  created_by bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
GRANT ALL ON public.dogg_broadcasts TO service_role;
ALTER TABLE public.dogg_broadcasts ENABLE ROW LEVEL SECURITY;
CREATE INDEX dogg_broadcasts_active ON public.dogg_broadcasts (created_at) WHERE status IN ('queued','sending');