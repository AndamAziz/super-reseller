CREATE TABLE public.vod_library (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 media_type text NOT NULL CHECK (media_type IN ('movie','tv')),
 tmdb_id integer NOT NULL CHECK (tmdb_id > 0),
 title text NOT NULL,
 overview text NOT NULL DEFAULT '',
 poster_path text,
 release_date text,
 imdb_id text,
 season integer NOT NULL DEFAULT 1 CHECK (season > 0),
 episode integer NOT NULL DEFAULT 1 CHECK (episode > 0),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(media_type, tmdb_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vod_library TO authenticated;
GRANT ALL ON public.vod_library TO service_role;
ALTER TABLE public.vod_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_vod_library ON public.vod_library FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));