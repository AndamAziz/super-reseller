BEGIN;
DO $$
DECLARE p uuid; a uuid; b uuid; admin_id uuid; reseller_id uuid;
BEGIN
  SELECT user_id INTO admin_id FROM public.user_roles WHERE role = 'admin' LIMIT 1;
  SELECT user_id INTO reseller_id FROM public.user_roles WHERE role = 'reseller' LIMIT 1;
  IF admin_id IS NULL OR reseller_id IS NULL THEN RAISE EXCEPTION 'Test needs both roles'; END IF;
  INSERT INTO public.playlists(name) VALUES ('Ordering permission fixture') RETURNING id INTO p;
  INSERT INTO public.channels(playlist_id,name,url,position) VALUES(p,'A','https://media.test/a',0) RETURNING id INTO a;
  INSERT INTO public.channels(playlist_id,name,url,position) VALUES(p,'B','https://media.test/b',1) RETURNING id INTO b;
  PERFORM set_config('test.order_a',a::text,true);
  PERFORM set_config('test.order_b',b::text,true);
  PERFORM set_config('test.order_admin',admin_id::text,true);
  PERFORM set_config('test.order_reseller',reseller_id::text,true);
END $$;
SET LOCAL ROLE authenticated;
DO $$
DECLARE denied boolean := false;
BEGIN
  PERFORM set_config('request.jwt.claim.sub',current_setting('test.order_admin'),true);
  PERFORM set_config('request.jwt.claims',json_build_object('sub',current_setting('test.order_admin'),'role','authenticated')::text,true);
  PERFORM public.swap_channel_positions(current_setting('test.order_b')::uuid,current_setting('test.order_a')::uuid);
  IF (SELECT position FROM public.channels WHERE id=current_setting('test.order_b')::uuid) <> 0 THEN RAISE EXCEPTION 'Admin move up failed'; END IF;
  PERFORM public.swap_channel_positions(current_setting('test.order_b')::uuid,current_setting('test.order_a')::uuid);
  IF (SELECT position FROM public.channels WHERE id=current_setting('test.order_b')::uuid) <> 1 THEN RAISE EXCEPTION 'Admin move down failed'; END IF;
  PERFORM set_config('request.jwt.claim.sub',current_setting('test.order_reseller'),true);
  PERFORM set_config('request.jwt.claims',json_build_object('sub',current_setting('test.order_reseller'),'role','authenticated')::text,true);
  BEGIN
    PERFORM public.swap_channel_positions(current_setting('test.order_b')::uuid,current_setting('test.order_a')::uuid);
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Reseller reordered channels'; END IF;
END $$;
SET LOCAL ROLE anon;
DO $$
DECLARE denied boolean := false;
BEGIN
  BEGIN
    PERFORM public.swap_channel_positions(current_setting('test.order_b')::uuid,current_setting('test.order_a')::uuid);
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Anonymous reordered channels'; END IF;
END $$;
ROLLBACK;