ALTER TABLE public.lines DROP CONSTRAINT lines_max_connections_check;
ALTER TABLE public.lines ADD CONSTRAINT lines_max_connections_check CHECK (max_connections >= 1);
ALTER TABLE public.lines ALTER COLUMN max_connections SET DEFAULT 1;
CREATE OR REPLACE FUNCTION public.update_line(_line_id uuid, _password text, _custom_host text, _max_connections integer, _expires_at timestamptz DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _admin boolean; _line public.lines; _cost integer := 0;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  _admin := public.has_role(_uid, 'admin');
  IF NOT _admin AND NOT public.has_role(_uid, 'reseller') THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF _max_connections IS NULL OR _max_connections < 1 THEN RAISE EXCEPTION 'Max connections must be a positive integer'; END IF;
  IF _password IS NULL OR length(_password) < 4 OR length(_password) > 100 THEN RAISE EXCEPTION 'Password must be between 4 and 100 characters'; END IF;
  IF NOT _admin AND _expires_at IS NOT NULL THEN RAISE EXCEPTION 'Only admins can change expiry directly — use Renew'; END IF;
  SELECT * INTO _line FROM public.lines WHERE id = _line_id FOR UPDATE;
  IF _line.id IS NULL THEN RAISE EXCEPTION 'Line not found'; END IF;
  IF NOT _admin AND _line.reseller_id <> _uid THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF NOT _admin THEN _cost := public.connection_upgrade_cost(_line.expires_at, _line.max_connections, _max_connections, now()); END IF;
  UPDATE public.lines SET password = _password, custom_host = nullif(trim(_custom_host), ''), max_connections = _max_connections, expires_at = coalesce(_expires_at, expires_at) WHERE id = _line_id;
  RETURN _cost;
END;
$$;