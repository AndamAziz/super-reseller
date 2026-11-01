ALTER TABLE public.content_series ADD COLUMN english_name text, ADD COLUMN original_name text, ADD COLUMN tmdb_id integer CHECK (tmdb_id > 0), ADD COLUMN provider_key text NOT NULL DEFAULT 'github';
ALTER TABLE public.content_episodes ADD COLUMN language_label text NOT NULL DEFAULT '' CHECK (length(language_label) <= 200);
CREATE UNIQUE INDEX content_series_provider_tmdb ON public.content_series(owner_id, provider_key, tmdb_id) WHERE tmdb_id IS NOT NULL;
GRANT UPDATE(language_label) ON public.content_episodes TO authenticated;
CREATE FUNCTION public.add_provider_youtube_episode(_owner_id uuid, _provider_key text, _english_name text, _original_name text, _tmdb_id integer, _season_number integer, _episode_number integer, _language_label text, _original_url text, _video_id text, _poster_url text) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE sid uuid; nid uuid; eid uuid; base_title text; stored public.content_series;
BEGIN
 IF NOT public.has_role(auth.uid(), 'admin') AND NOT (auth.uid() = _owner_id AND public.has_role(auth.uid(), 'reseller')) THEN RAISE EXCEPTION 'Access denied'; END IF;
 IF _provider_key <> 'github' AND NOT EXISTS (SELECT 1 FROM public.playlists WHERE id::text = _provider_key) THEN RAISE EXCEPTION 'Provider not accessible'; END IF;
 IF length(trim(_english_name)) NOT BETWEEN 1 AND 120 OR length(trim(_original_name)) NOT BETWEEN 1 AND 120 OR _tmdb_id <= 0 OR length(trim(_language_label)) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Invalid series details'; END IF;
 base_title := trim(_english_name) || ' _ ' || trim(_original_name) || ' {tmdb-' || _tmdb_id || '}';
 INSERT INTO public.content_series(owner_id,title,category,poster_url,english_name,original_name,tmdb_id,provider_key) VALUES (_owner_id,base_title,trim(_language_label),_poster_url,trim(_english_name),trim(_original_name),_tmdb_id,_provider_key) ON CONFLICT (owner_id,provider_key,tmdb_id) WHERE tmdb_id IS NOT NULL DO NOTHING;
 SELECT * INTO stored FROM public.content_series WHERE owner_id = _owner_id AND provider_key = _provider_key AND tmdb_id = _tmdb_id;
 IF stored.id IS NULL THEN RAISE EXCEPTION 'Series not accessible'; END IF;
 IF stored.english_name <> trim(_english_name) OR stored.original_name <> trim(_original_name) THEN RAISE EXCEPTION 'Use the existing names for this TMDB series'; END IF;
 sid := stored.id;
 INSERT INTO public.content_seasons(series_id,owner_id,season_number) VALUES (sid,_owner_id,_season_number) ON CONFLICT (series_id,season_number) DO NOTHING;
 SELECT id INTO nid FROM public.content_seasons WHERE series_id = sid AND season_number = _season_number;
 INSERT INTO public.content_episodes(series_id,season_id,owner_id,season_number,episode_number,title,youtube_video_id,original_url,poster_url,language_label,published) VALUES (sid,nid,_owner_id,_season_number,_episode_number,base_title || ' - S' || lpad(_season_number::text,greatest(2,length(_season_number::text)),'0') || 'E' || lpad(_episode_number::text,greatest(2,length(_episode_number::text)),'0'),_video_id,_original_url,_poster_url,trim(_language_label),true) RETURNING id INTO eid;
 RETURN eid;
END $$;
REVOKE ALL ON FUNCTION public.add_provider_youtube_episode(uuid,text,text,text,integer,integer,integer,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_provider_youtube_episode(uuid,text,text,text,integer,integer,integer,text,text,text,text) TO authenticated;
CREATE FUNCTION public.name_structured_youtube_episode() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE parent public.content_series;
BEGIN
 SELECT * INTO parent FROM public.content_series WHERE id = NEW.series_id;
 IF parent.tmdb_id IS NOT NULL THEN NEW.title := parent.english_name || ' _ ' || parent.original_name || ' {tmdb-' || parent.tmdb_id || '} - S' || lpad(NEW.season_number::text,greatest(2,length(NEW.season_number::text)),'0') || 'E' || lpad(NEW.episode_number::text,greatest(2,length(NEW.episode_number::text)),'0'); END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER name_structured_youtube_episode BEFORE INSERT OR UPDATE ON public.content_episodes FOR EACH ROW EXECUTE FUNCTION public.name_structured_youtube_episode();