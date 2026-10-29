ALTER TABLE public.active_connections ADD COLUMN IF NOT EXISTS user_agent text;
ALTER TABLE public.active_connections ADD COLUMN IF NOT EXISTS ip text;

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
BEGIN
  DELETE FROM public.active_connections WHERE last_seen < now() - interval '90 seconds';
  INSERT INTO public.active_connections(line_id, client_key, last_seen, user_agent, ip)
  VALUES (_line_id, _client_key, now(), left(_user_agent, 300), left(_ip, 64))
  ON CONFLICT (line_id, client_key)
  DO UPDATE SET last_seen = now(), user_agent = excluded.user_agent, ip = excluded.ip;
  RETURN (SELECT count(*) FROM public.active_connections WHERE line_id = _line_id AND last_seen > now() - interval '90 seconds') <= _max;
END;
$$;