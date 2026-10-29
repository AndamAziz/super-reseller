CREATE OR REPLACE FUNCTION public.connection_upgrade_cost(_expires_at timestamptz, _old_connections integer, _new_connections integer, _at timestamptz)
RETURNS integer LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE _months integer := 0;
BEGIN
  IF _new_connections <= _old_connections OR _expires_at <= _at THEN RETURN 0; END IF;
  WHILE (_at AT TIME ZONE 'UTC') + make_interval(months => _months) < (_expires_at AT TIME ZONE 'UTC') LOOP
    _months := _months + 1;
  END LOOP;
  RETURN (_new_connections - _old_connections) * _months;
END;
$$;
CREATE OR REPLACE FUNCTION public.update_line(_line_id uuid, _password text, _custom_host text, _max_connections integer, _expires_at timestamptz DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _admin boolean; _line public.lines; _cost integer := 0; _balance integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  _admin := public.has_role(_uid, 'admin');
  IF NOT _admin AND NOT public.has_role(_uid, 'reseller') THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF _max_connections IS NULL OR _max_connections < 1 OR _max_connections > 100 THEN RAISE EXCEPTION 'Max connections must be between 1 and 100'; END IF;
  IF _password IS NULL OR length(_password) < 4 OR length(_password) > 100 THEN RAISE EXCEPTION 'Password must be between 4 and 100 characters'; END IF;
  IF NOT _admin AND _expires_at IS NOT NULL THEN RAISE EXCEPTION 'Only admins can change expiry directly — use Renew'; END IF;
  SELECT * INTO _line FROM public.lines WHERE id = _line_id FOR UPDATE;
  IF _line.id IS NULL THEN RAISE EXCEPTION 'Line not found'; END IF;
  IF NOT _admin AND _line.reseller_id <> _uid THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF NOT _admin THEN
    _cost := public.connection_upgrade_cost(_line.expires_at, _line.max_connections, _max_connections, now());
    IF _cost > 0 THEN
      SELECT credits INTO _balance FROM public.profiles WHERE id = _uid FOR UPDATE;
      IF _balance IS NULL OR _balance < _cost THEN RAISE EXCEPTION 'Insufficient credits (need %, have %)', _cost, coalesce(_balance, 0); END IF;
      UPDATE public.profiles SET credits = credits - _cost WHERE id = _uid;
      INSERT INTO public.credit_transactions(reseller_id, actor_id, amount, reason)
      VALUES (_uid, _uid, -_cost, 'Connections ' || _line.username || ' (' || _line.max_connections || ' → ' || _max_connections || ', remaining months rounded up)');
    END IF;
  END IF;
  UPDATE public.lines SET password = _password, custom_host = nullif(trim(_custom_host), ''), max_connections = _max_connections, expires_at = coalesce(_expires_at, expires_at) WHERE id = _line_id;
  RETURN _cost;
END;
$$;
REVOKE ALL ON FUNCTION public.update_line(uuid, text, text, integer, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_line(uuid, text, text, integer, timestamptz) TO authenticated;
CREATE OR REPLACE FUNCTION public.renew_line(_line_id uuid, _months integer)
RETURNS public.lines LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _is_admin boolean; _line public.lines; _bal integer; _cost integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _months IS NULL OR _months < 1 OR _months > 24 THEN RAISE EXCEPTION 'Months must be between 1 and 24'; END IF;
  _is_admin := public.has_role(_uid, 'admin');
  IF NOT _is_admin AND NOT public.has_role(_uid, 'reseller') THEN RAISE EXCEPTION 'Not allowed'; END IF;
  SELECT * INTO _line FROM public.lines WHERE id = _line_id FOR UPDATE;
  IF _line.id IS NULL THEN RAISE EXCEPTION 'Line not found'; END IF;
  IF NOT _is_admin AND _line.reseller_id <> _uid THEN RAISE EXCEPTION 'Not allowed'; END IF;
  _cost := _months * _line.max_connections;
  IF NOT _is_admin THEN
    SELECT credits INTO _bal FROM public.profiles WHERE id = _uid FOR UPDATE;
    IF _bal IS NULL OR _bal < _cost THEN RAISE EXCEPTION 'Insufficient credits (need %, have %)', _cost, coalesce(_bal, 0); END IF;
    UPDATE public.profiles SET credits = credits - _cost WHERE id = _uid;
    INSERT INTO public.credit_transactions(reseller_id, actor_id, amount, reason)
    VALUES (_uid, _uid, -_cost, 'Renew ' || _line.username || ' (' || _months || ' mo × ' || _line.max_connections || ' connections)');
  END IF;
  UPDATE public.lines SET expires_at = greatest(expires_at, now()) + make_interval(months => _months) WHERE id = _line_id RETURNING * INTO _line;
  RETURN _line;
END;
$$;