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
    SELECT max_connections INTO saved_max FROM public.lines
      WHERE id = _line_id AND reseller_id = auth.uid();
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
    END IF;
    _max := saved_max;
  END IF;
  DELETE FROM public.active_connections WHERE last_seen < now() - interval '90 seconds'
    AND (trusted_playback OR line_id = _line_id);
  SELECT count(*) INTO active_count FROM public.active_connections WHERE line_id = _line_id;
  IF NOT EXISTS (SELECT 1 FROM public.active_connections WHERE line_id = _line_id AND client_key = _client_key)
     AND active_count >= GREATEST(_max, 1) THEN
    RETURN false;
  END IF;
  INSERT INTO public.active_connections (line_id, client_key, last_seen)
  VALUES (_line_id, _client_key, now())
  ON CONFLICT (line_id, client_key) DO UPDATE SET last_seen = now();
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_stream_limit(_line_id uuid, _client_key text, _max integer, _user_agent text DEFAULT NULL::text, _ip text DEFAULT NULL::text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  active_count int;
  trusted_playback boolean := coalesce(auth.role() = 'service_role', false);
  saved_max integer;
BEGIN
  IF NOT trusted_playback THEN
    IF auth.uid() IS NULL OR auth.role() IS DISTINCT FROM 'authenticated' THEN
      RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
    END IF;
    SELECT max_connections INTO saved_max FROM public.lines
      WHERE id = _line_id AND reseller_id = auth.uid();
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
    END IF;
    _max := saved_max;
  END IF;
  DELETE FROM public.active_connections WHERE last_seen < now() - interval '90 seconds'
    AND (trusted_playback OR line_id = _line_id);
  UPDATE public.active_connections
     SET last_seen = now(), user_agent = left(_user_agent, 300), ip = left(_ip, 64)
   WHERE line_id = _line_id AND client_key = _client_key;
  IF NOT FOUND THEN
    SELECT count(*) INTO active_count FROM public.active_connections WHERE line_id = _line_id;
    IF active_count >= _max THEN RETURN false; END IF;
    INSERT INTO public.active_connections(line_id, client_key, last_seen, user_agent, ip)
    VALUES (_line_id, _client_key, now(), left(_user_agent, 300), left(_ip, 64));
  END IF;
  SELECT count(*) INTO active_count FROM public.active_connections WHERE line_id = _line_id;
  RETURN active_count <= _max;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.check_stream_limit(uuid, text, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_stream_limit(uuid, text, integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_stream_limit(uuid, text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_stream_limit(uuid, text, integer, text, text) TO authenticated, service_role;