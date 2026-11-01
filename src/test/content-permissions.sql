-- Transactional integration checks; all temporary content is rolled back.
BEGIN;
DO $$
DECLARE a uuid; b uuid; s uuid; n uuid;
BEGIN
 SELECT user_id INTO a FROM public.user_roles WHERE role = 'reseller' ORDER BY user_id LIMIT 1;
 SELECT user_id INTO b FROM public.user_roles WHERE role = 'reseller' AND user_id <> a ORDER BY user_id LIMIT 1;
 IF a IS NULL OR b IS NULL THEN RAISE EXCEPTION 'Two resellers required for ownership checks'; END IF;
 PERFORM set_config('test.a', a::text, true); PERFORM set_config('test.b', b::text, true);
 INSERT INTO public.content_series(owner_id,title,poster_url) VALUES(a,'Episode permission fixture','https://images.example/series.jpg') RETURNING id INTO s;
 INSERT INTO public.content_seasons(owner_id,series_id,season_number) VALUES(a,s,1) RETURNING id INTO n;
 PERFORM set_config('test.series',s::text,true); PERFORM set_config('test.season',n::text,true);
END $$;
SET LOCAL ROLE authenticated;
DO $$
DECLARE e uuid; changed integer;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',current_setting('test.a'),true);
 PERFORM set_config('request.jwt.claims',json_build_object('sub',current_setting('test.a'),'role','authenticated')::text,true);
 INSERT INTO public.content_episodes(owner_id,series_id,season_id,season_number,episode_number,title,youtube_video_id,original_url,published)
 VALUES(current_setting('test.a')::uuid,current_setting('test.series')::uuid,current_setting('test.season')::uuid,1,21,'Episode 21','dQw4w9WgXcQ','https://youtu.be/dQw4w9WgXcQ',true) RETURNING id INTO e;
 PERFORM set_config('test.episode',e::text,true);
 BEGIN
  INSERT INTO public.content_episodes(owner_id,series_id,season_id,season_number,episode_number,title,youtube_video_id,original_url)
  VALUES(current_setting('test.a')::uuid,current_setting('test.series')::uuid,current_setting('test.season')::uuid,1,21,'Duplicate','dQw4w9WgXcQ','https://youtu.be/dQw4w9WgXcQ');
  RAISE EXCEPTION 'Duplicate episode was not rejected';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 INSERT INTO public.content_episodes(owner_id,series_id,season_id,season_number,episode_number,title,youtube_video_id,original_url,published)
 VALUES(current_setting('test.a')::uuid,current_setting('test.series')::uuid,current_setting('test.season')::uuid,1,22,'Episode 22','dQw4w9WgXcQ','https://youtube.com/live/dQw4w9WgXcQ',false);
 IF (SELECT count(*) FROM public.content_episodes WHERE series_id=current_setting('test.series')::uuid) <> 2 THEN RAISE EXCEPTION 'Episode 22 changed episode 21 or draft read failed'; END IF;
 BEGIN
  UPDATE public.content_episodes SET youtube_video_id='aaaaaaaaaaa' WHERE id=e;
  RAISE EXCEPTION 'Mismatched URL accepted';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'Invalid or mismatched YouTube video ID' THEN RAISE; END IF;
 END;
 PERFORM set_config('request.jwt.claim.sub',current_setting('test.b'),true);
 PERFORM set_config('request.jwt.claims',json_build_object('sub',current_setting('test.b'),'role','authenticated')::text,true);
 IF EXISTS(SELECT 1 FROM public.content_episodes WHERE id=e) THEN RAISE EXCEPTION 'Other reseller read content'; END IF;
 UPDATE public.content_episodes SET title='Unauthorized' WHERE id=e;
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed <> 0 THEN RAISE EXCEPTION 'Other reseller edited content'; END IF;
 DELETE FROM public.content_episodes WHERE id=e;
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed <> 0 THEN RAISE EXCEPTION 'Other reseller deleted content'; END IF;
 BEGIN
  INSERT INTO public.content_seasons(owner_id,series_id,season_number) VALUES(current_setting('test.b')::uuid,current_setting('test.series')::uuid,2);
  RAISE EXCEPTION 'Cross-owner parent accepted';
 EXCEPTION WHEN foreign_key_violation THEN NULL; END;
END $$;
SET LOCAL ROLE anon;
DO $$ BEGIN
 BEGIN
  IF EXISTS(SELECT 1 FROM public.content_episodes WHERE series_id=current_setting('test.series')::uuid) THEN RAISE EXCEPTION 'Anonymous reads allowed'; END IF;
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
ROLLBACK;