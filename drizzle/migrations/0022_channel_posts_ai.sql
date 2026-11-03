ALTER TABLE public.dogg_channel_posts
  ADD COLUMN status text NOT NULL DEFAULT 'sent',
  ADD COLUMN kind text NOT NULL DEFAULT 'curated',
  ADD COLUMN title text,
  ADD COLUMN angle text,
  ADD COLUMN caption text,
  ADD COLUMN button_text text,
  ADD COLUMN image_headline text,
  ADD COLUMN image_subline text,
  ADD COLUMN image_scene text,
  ADD COLUMN attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN lease_until timestamptz,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.dogg_channel_posts ALTER COLUMN post_index DROP NOT NULL;