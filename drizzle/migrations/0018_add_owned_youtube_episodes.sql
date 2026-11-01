CREATE TABLE public.content_series (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL DEFAULT auth.uid(),
 title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 300),
 category text NOT NULL DEFAULT 'YouTube',
 poster_url text,
 description text NOT NULL DEFAULT '',
 source_identity text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id, owner_id), UNIQUE(owner_id, source_identity)
);
GRANT SELECT, INSERT, DELETE ON public.content_series TO authenticated;
GRANT UPDATE(title, category, poster_url, description) ON public.content_series TO authenticated;
GRANT ALL ON public.content_series TO service_role;
ALTER TABLE public.content_series ENABLE ROW LEVEL SECURITY;
CREATE POLICY content_series_owner_admin ON public.content_series FOR ALL TO authenticated USING ((owner_id = auth.uid() AND public.has_role(auth.uid(), 'reseller')) OR public.has_role(auth.uid(), 'admin')) WITH CHECK ((owner_id = auth.uid() AND public.has_role(auth.uid(), 'reseller')) OR public.has_role(auth.uid(), 'admin'));
CREATE TABLE public.content_seasons (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 series_id uuid NOT NULL,
 owner_id uuid NOT NULL DEFAULT auth.uid(),
 season_number integer NOT NULL CHECK (season_number BETWEEN 1 AND 999),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(series_id, owner_id) REFERENCES public.content_series(id, owner_id) ON DELETE CASCADE,
 UNIQUE(series_id, season_number), UNIQUE(id, series_id, owner_id, season_number)
);
GRANT SELECT, INSERT, DELETE ON public.content_seasons TO authenticated;
GRANT ALL ON public.content_seasons TO service_role;
ALTER TABLE public.content_seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY content_seasons_owner_admin ON public.content_seasons FOR ALL TO authenticated USING ((owner_id = auth.uid() AND public.has_role(auth.uid(), 'reseller')) OR public.has_role(auth.uid(), 'admin')) WITH CHECK ((owner_id = auth.uid() AND public.has_role(auth.uid(), 'reseller')) OR public.has_role(auth.uid(), 'admin'));
CREATE TABLE public.content_episodes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 series_id uuid NOT NULL,
 season_id uuid NOT NULL,
 owner_id uuid NOT NULL DEFAULT auth.uid(),
 season_number integer NOT NULL,
 episode_number integer NOT NULL CHECK (episode_number BETWEEN 1 AND 9999),
 title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 300),
 youtube_video_id text NOT NULL CHECK (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
 original_url text NOT NULL,
 poster_url text,
 description text NOT NULL DEFAULT '',
 release_date date,
 source_type text NOT NULL DEFAULT 'youtube' CHECK (source_type = 'youtube'),
 published boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(season_id, series_id, owner_id, season_number) REFERENCES public.content_seasons(id, series_id, owner_id, season_number) ON DELETE CASCADE,
 UNIQUE(series_id, season_number, episode_number)
);
GRANT SELECT, INSERT, DELETE ON public.content_episodes TO authenticated;
GRANT UPDATE(episode_number, title, youtube_video_id, original_url, poster_url, description, release_date, published) ON public.content_episodes TO authenticated;
GRANT ALL ON public.content_episodes TO service_role;
ALTER TABLE public.content_episodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY content_episodes_owner_admin ON public.content_episodes FOR ALL TO authenticated USING ((owner_id = auth.uid() AND public.has_role(auth.uid(), 'reseller')) OR public.has_role(auth.uid(), 'admin')) WITH CHECK ((owner_id = auth.uid() AND public.has_role(auth.uid(), 'reseller')) OR public.has_role(auth.uid(), 'admin'));
CREATE INDEX content_episodes_published_owner ON public.content_episodes(owner_id, published, series_id, season_number, episode_number);
CREATE FUNCTION public.validate_content_record() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE parsed_id text; matched text[];
BEGIN
 IF TG_OP = 'UPDATE' AND NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN RAISE EXCEPTION 'Content ownership is immutable'; END IF;
 IF TG_TABLE_NAME IN ('content_series', 'content_episodes') THEN
  NEW.updated_at := now();
  IF NEW.poster_url IS NOT NULL AND (length(NEW.poster_url) > 4000 OR NEW.poster_url !~ '^https://[^[:space:]]+$') THEN RAISE EXCEPTION 'Poster must be an HTTPS URL'; END IF;
 END IF;
 IF TG_TABLE_NAME = 'content_episodes' THEN
  IF length(NEW.original_url) > 4000 THEN RAISE EXCEPTION 'Invalid YouTube URL'; END IF;
  matched := regexp_match(NEW.original_url, '^https://youtu\.be/([A-Za-z0-9_-]{11})([?#].*)?$');
  IF matched IS NOT NULL THEN parsed_id := matched[1]; END IF;
  IF parsed_id IS NULL THEN
   matched := regexp_match(NEW.original_url, '^https://(www\.|m\.)?youtube\.com/(embed|live)/([A-Za-z0-9_-]{11})([?#].*)?$');
   IF matched IS NOT NULL THEN parsed_id := matched[3]; END IF;
  END IF;
  IF parsed_id IS NULL AND NEW.original_url ~ '^https://(www\.|m\.)?youtube\.com/watch\?' THEN
   matched := regexp_match(NEW.original_url, '[?&]v=([A-Za-z0-9_-]{11})(&.*)?$');
   IF matched IS NOT NULL THEN parsed_id := matched[1]; END IF;
  END IF;
  IF parsed_id IS NULL OR parsed_id <> NEW.youtube_video_id THEN RAISE EXCEPTION 'Invalid or mismatched YouTube video ID'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_content_series BEFORE INSERT OR UPDATE ON public.content_series FOR EACH ROW EXECUTE FUNCTION public.validate_content_record();
CREATE TRIGGER validate_content_episode BEFORE INSERT OR UPDATE ON public.content_episodes FOR EACH ROW EXECUTE FUNCTION public.validate_content_record();
CREATE TRIGGER validate_content_season BEFORE UPDATE ON public.content_seasons FOR EACH ROW EXECUTE FUNCTION public.validate_content_record();