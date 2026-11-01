BEGIN;
DO $$
DECLARE a uuid; b uuid;
BEGIN
 SELECT user_id INTO a FROM public.user_roles WHERE role='reseller' ORDER BY user_id LIMIT 1;
 SELECT user_id INTO b FROM public.user_roles WHERE role='reseller' AND user_id<>a LIMIT 1;
 IF a IS NULL OR b IS NULL THEN RAISE EXCEPTION 'Two resellers required'; END IF;
 PERFORM set_config('test.a',a::text,true); PERFORM set_config('test.b',b::text,true);
END $$;
SET LOCAL ROLE authenticated;
DO $$
DECLARE e uuid; r record;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',current_setting('test.a'),true);
 PERFORM set_config('request.jwt.claims',json_build_object('sub',current_setting('test.a'),'role','authenticated')::text,true);
 e:=public.add_provider_youtube_episode(current_setting('test.a')::uuid,'github','Setayesh','ستایش',94146,1,17,'KURDISH-دۆبلاژ','https://www.youtube.com/watch?v=3leqKX7BsFw','3leqKX7BsFw','https://media.themoviedb.org/t/p/w600_and_h900_face/6e7Wkc5jckzksjKta4TELHCufs.jpg');
 SELECT s.tmdb_id,s.provider_key,e.* INTO r FROM public.content_episodes e JOIN public.content_series s ON s.id=e.series_id WHERE e.id=e;
 IF r.title <> 'Setayesh _ ستایش {tmdb-94146} - S01E17' OR r.tmdb_id<>94146 OR r.season_number<>1 OR r.episode_number<>17 OR r.provider_key<>'github' OR r.language_label<>'KURDISH-دۆبلاژ' THEN RAISE EXCEPTION 'Incorrect persisted metadata'; END IF;
 BEGIN
  PERFORM public.add_provider_youtube_episode(current_setting('test.a')::uuid,'github','Setayesh','ستایش',94146,1,17,'KURDISH-دۆبلاژ','https://www.youtube.com/watch?v=3leqKX7BsFw','3leqKX7BsFw',NULL);
  RAISE EXCEPTION 'Duplicate accepted';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub',current_setting('test.b'),true);
 PERFORM set_config('request.jwt.claims',json_build_object('sub',current_setting('test.b'),'role','authenticated')::text,true);
 BEGIN
  PERFORM public.add_provider_youtube_episode(current_setting('test.a')::uuid,'github','Setayesh','ستایش',94146,1,18,'ENGLISH','https://youtu.be/3leqKX7BsFw','3leqKX7BsFw',NULL);
  RAISE EXCEPTION 'Foreign owner accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Access denied' THEN RAISE; END IF; END;
END $$;
SET LOCAL ROLE anon;
DO $$ BEGIN
 BEGIN
  PERFORM public.add_provider_youtube_episode(current_setting('test.a')::uuid,'github','Setayesh','ستایش',94146,1,18,'ENGLISH','https://youtu.be/3leqKX7BsFw','3leqKX7BsFw',NULL);
  RAISE EXCEPTION 'Anonymous creation accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
ROLLBACK;