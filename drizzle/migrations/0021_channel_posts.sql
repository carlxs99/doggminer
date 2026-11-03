CREATE TABLE public.dogg_channel_posts (
  week_key text PRIMARY KEY,
  post_index integer NOT NULL,
  chat text NOT NULL,
  message_id bigint,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
GRANT ALL ON public.dogg_channel_posts TO service_role;
ALTER TABLE public.dogg_channel_posts ENABLE ROW LEVEL SECURITY;