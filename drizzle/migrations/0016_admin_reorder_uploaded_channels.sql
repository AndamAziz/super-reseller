CREATE OR REPLACE FUNCTION public.swap_channel_positions(_channel_id uuid, _neighbor_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _playlist_id uuid;
  _position integer;
  _neighbor_position integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can reorder channels' USING ERRCODE = '42501';
  END IF;
  IF _channel_id = _neighbor_id THEN
    RAISE EXCEPTION 'Choose two different channels';
  END IF;
  SELECT playlist_id INTO _playlist_id FROM public.channels WHERE id = _channel_id;
  IF _playlist_id IS NULL THEN RAISE EXCEPTION 'Channel not found'; END IF;
  PERFORM id FROM public.playlists WHERE id = _playlist_id FOR UPDATE;
  PERFORM id FROM public.channels WHERE playlist_id = _playlist_id ORDER BY id FOR UPDATE;
  SELECT position INTO _position FROM public.channels WHERE id = _channel_id AND playlist_id = _playlist_id;
  SELECT position INTO _neighbor_position FROM public.channels WHERE id = _neighbor_id AND playlist_id = _playlist_id;
  IF _position IS NULL OR _neighbor_position IS NULL THEN
    RAISE EXCEPTION 'Both channels must belong to the same playlist';
  END IF;
  IF _position = _neighbor_position THEN
    WITH ranked AS (SELECT id, (row_number() OVER (ORDER BY position, id) - 1)::integer AS new_position FROM public.channels WHERE playlist_id = _playlist_id)
    UPDATE public.channels c SET position = ranked.new_position FROM ranked WHERE c.id = ranked.id;
    SELECT position INTO _position FROM public.channels WHERE id = _channel_id;
    SELECT position INTO _neighbor_position FROM public.channels WHERE id = _neighbor_id;
  END IF;
  UPDATE public.channels SET position = CASE WHEN id = _channel_id THEN _neighbor_position ELSE _position END
  WHERE playlist_id = _playlist_id AND id IN (_channel_id, _neighbor_id);
END;
$$;
REVOKE ALL ON FUNCTION public.swap_channel_positions(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.swap_channel_positions(uuid, uuid) TO authenticated;