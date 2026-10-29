-- Blocked devices (over Max connections) were recorded before being rejected, so the
-- active-device count and list showed watchers that never actually streamed.
-- Record a device only when it is allowed to stream; keep counts exact.
CREATE OR REPLACE FUNCTION public.check_stream_limit(
  _line_id uuid,
  _client_key text,
  _max int,
  _user_agent text DEFAULT NULL,
  _ip text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_count int;
BEGIN
  DELETE FROM public.active_connections WHERE last_seen < now() - interval '90 seconds';

  -- known device: just refresh its heartbeat
  UPDATE public.active_connections
     SET last_seen = now(),
         user_agent = left(_user_agent, 300),
         ip = left(_ip, 64)
   WHERE line_id = _line_id AND client_key = _client_key;

  IF NOT FOUND THEN
    -- new device: only register it if there is a free connection slot
    SELECT count(*) INTO active_count FROM public.active_connections WHERE line_id = _line_id;
    IF active_count >= _max THEN
      RETURN false;
    END IF;
    INSERT INTO public.active_connections(line_id, client_key, last_seen, user_agent, ip)
    VALUES (_line_id, _client_key, now(), left(_user_agent, 300), left(_ip, 64));
  END IF;

  SELECT count(*) INTO active_count FROM public.active_connections WHERE line_id = _line_id;
  RETURN active_count <= _max;
END;
$$;