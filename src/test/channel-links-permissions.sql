-- Integration check: no production rows are retained.
BEGIN;
DO $$
DECLARE
  reseller_id uuid;
  playlist uuid;
  channel uuid;
BEGIN
  SELECT user_id INTO reseller_id FROM public.user_roles WHERE role = 'reseller' LIMIT 1;
  IF reseller_id IS NULL THEN RAISE EXCEPTION 'A reseller is required for this integration test'; END IF;
  INSERT INTO public.playlists(name) VALUES ('Channel permission test') RETURNING id INTO playlist;
  INSERT INTO public.channels(playlist_id, name, url) VALUES (playlist, 'Permission check', 'https://media.test/original.mp3') RETURNING id INTO channel;
  PERFORM set_config('request.jwt.claim.sub', reseller_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', reseller_id, 'role', 'authenticated')::text, true);
  PERFORM set_config('test.channel_id', channel::text, true);
END $$;
SET LOCAL ROLE authenticated;
DO $$
DECLARE changed integer;
BEGIN
  UPDATE public.channels SET url = 'https://media.test/forbidden.mp4', logo = 'https://images.test/forbidden.png'
    WHERE id = current_setting('test.channel_id')::uuid;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 0 THEN RAISE EXCEPTION 'Resellers must not edit uploaded channel links'; END IF;
END $$;
ROLLBACK;