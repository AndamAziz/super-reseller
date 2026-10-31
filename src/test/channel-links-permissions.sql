-- Run using the privileged data-query tool, not the read-only CLI.
-- Every fixture and edit is rolled back, including on assertion failure.
BEGIN;
DO $$
DECLARE
  admin_id uuid;
  reseller_id uuid;
  playlist_id uuid;
  channel_id uuid;
BEGIN
  SELECT user_id INTO admin_id FROM public.user_roles WHERE role = 'admin' LIMIT 1;
  SELECT user_id INTO reseller_id FROM public.user_roles WHERE role = 'reseller' LIMIT 1;
  IF admin_id IS NULL OR reseller_id IS NULL THEN
    RAISE EXCEPTION 'Permission test requires an admin and reseller';
  END IF;
  INSERT INTO public.playlists(name) VALUES ('Transactional channel permission test') RETURNING id INTO playlist_id;
  INSERT INTO public.channels(playlist_id, name, url, logo)
  VALUES (playlist_id, 'Permission fixture', 'https://media.test/original.mp3', 'https://images.test/original.png')
  RETURNING id INTO channel_id;
  PERFORM set_config('test.channel_id', channel_id::text, true);
  PERFORM set_config('test.admin_id', admin_id::text, true);
  PERFORM set_config('test.reseller_id', reseller_id::text, true);
END $$;
SET LOCAL ROLE authenticated;
DO $$
DECLARE changed integer;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', current_setting('test.admin_id'), true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', current_setting('test.admin_id'), 'role', 'authenticated')::text, true);
  UPDATE public.channels SET url = 'https://media.test/admin.mp4', logo = 'https://images.test/admin.png'
  WHERE id = current_setting('test.channel_id')::uuid;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 1 THEN RAISE EXCEPTION 'Admin must be able to change both links'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.channels WHERE id = current_setting('test.channel_id')::uuid
    AND url = 'https://media.test/admin.mp4' AND logo = 'https://images.test/admin.png') THEN
    RAISE EXCEPTION 'Admin changes must read back';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', current_setting('test.reseller_id'), true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', current_setting('test.reseller_id'), 'role', 'authenticated')::text, true);
  UPDATE public.channels SET url = 'https://media.test/reseller.mp4' WHERE id = current_setting('test.channel_id')::uuid;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 0 THEN RAISE EXCEPTION 'Reseller must not change stream URL'; END IF;
  UPDATE public.channels SET logo = 'https://images.test/reseller.png' WHERE id = current_setting('test.channel_id')::uuid;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 0 THEN RAISE EXCEPTION 'Reseller must not change logo URL'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.channels WHERE id = current_setting('test.channel_id')::uuid
    AND url = 'https://media.test/admin.mp4' AND logo = 'https://images.test/admin.png') THEN
    RAISE EXCEPTION 'Rejected reseller changes must leave links unchanged';
  END IF;
END $$;
SET LOCAL ROLE anon;
DO $$
DECLARE changed integer;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  BEGIN
    UPDATE public.channels SET url = 'https://media.test/anonymous.mp4', logo = 'https://images.test/anonymous.png'
    WHERE id = current_setting('test.channel_id')::uuid;
    GET DIAGNOSTICS changed = ROW_COUNT;
    IF changed <> 0 THEN RAISE EXCEPTION 'Signed-out users must not change links'; END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
ROLLBACK;