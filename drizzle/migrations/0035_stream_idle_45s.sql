CREATE OR REPLACE FUNCTION public.check_stream_limit(_line_id uuid, _client_key text, _max integer, _user_agent text DEFAULT NULL::text, _ip text DEFAULT NULL::text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  active_count integer;
  trusted_playback boolean := coalesce(auth.role() = 'service_role', false);
  saved_max integer;
BEGIN
  IF NOT trusted_playback THEN
    IF auth.uid() IS NULL OR auth.role() IS DISTINCT FROM 'authenticated' THEN
      RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
    END IF;
    SELECT max_connections INTO saved_max FROM public.lines WHERE id = _line_id AND reseller_id = auth.uid();
    IF NOT FOUND THEN RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501'; END IF;
    _max := saved_max;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_line_id::text, 0));
  DELETE FROM public.active_connections WHERE line_id = _line_id AND last_seen < now() - interval '45 seconds';
  UPDATE public.active_connections SET last_seen = now(), user_agent = left(_user_agent, 300), ip = left(_ip, 64)
   WHERE line_id = _line_id AND client_key = _client_key;
  IF FOUND THEN RETURN true; END IF;
  SELECT count(*) INTO active_count FROM public.active_connections WHERE line_id = _line_id;
  IF active_count >= GREATEST(_max, 1) THEN RETURN false; END IF;
  INSERT INTO public.active_connections(line_id, client_key, last_seen, user_agent, ip)
    VALUES (_line_id, _client_key, now(), left(_user_agent, 300), left(_ip, 64))
    ON CONFLICT (line_id, client_key) DO UPDATE SET last_seen = EXCLUDED.last_seen, user_agent = EXCLUDED.user_agent, ip = EXCLUDED.ip;
  RETURN true;
END;
$function$;
CREATE OR REPLACE FUNCTION public.check_stream_limit(_line_id uuid, _client_key text, _max integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  active_count integer;
  trusted_playback boolean := coalesce(auth.role() = 'service_role', false);
  saved_max integer;
BEGIN
  IF NOT trusted_playback THEN
    IF auth.uid() IS NULL OR auth.role() IS DISTINCT FROM 'authenticated' THEN
      RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
    END IF;
    SELECT max_connections INTO saved_max FROM public.lines WHERE id = _line_id AND reseller_id = auth.uid();
    IF NOT FOUND THEN RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501'; END IF;
    _max := saved_max;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_line_id::text, 0));
  DELETE FROM public.active_connections WHERE line_id = _line_id AND last_seen < now() - interval '45 seconds';
  UPDATE public.active_connections SET last_seen = now() WHERE line_id = _line_id AND client_key = _client_key;
  IF FOUND THEN RETURN true; END IF;
  SELECT count(*) INTO active_count FROM public.active_connections WHERE line_id = _line_id;
  IF active_count >= GREATEST(_max, 1) THEN RETURN false; END IF;
  INSERT INTO public.active_connections(line_id, client_key, last_seen)
    VALUES (_line_id, _client_key, now())
    ON CONFLICT (line_id, client_key) DO UPDATE SET last_seen = EXCLUDED.last_seen;
  RETURN true;
END;
$function$;