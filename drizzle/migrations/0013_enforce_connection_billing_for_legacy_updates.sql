CREATE OR REPLACE FUNCTION public.bill_connection_increase()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cost integer; _balance integer; _actor uuid := auth.uid();
BEGIN
  IF NEW.max_connections <= OLD.max_connections THEN RETURN NEW; END IF;
  IF _actor IS NOT NULL AND public.has_role(_actor, 'admin') THEN RETURN NEW; END IF;
  IF NOT public.has_role(OLD.reseller_id, 'reseller') THEN RETURN NEW; END IF;
  IF _actor IS NOT NULL AND _actor <> OLD.reseller_id THEN RAISE EXCEPTION 'Not allowed'; END IF;
  _cost := public.connection_upgrade_cost(OLD.expires_at, OLD.max_connections, NEW.max_connections, now());
  IF _cost = 0 THEN RETURN NEW; END IF;
  SELECT credits INTO _balance FROM public.profiles WHERE id = OLD.reseller_id FOR UPDATE;
  IF _balance IS NULL OR _balance < _cost THEN RAISE EXCEPTION 'Insufficient credits (need %, have %)', _cost, coalesce(_balance, 0); END IF;
  UPDATE public.profiles SET credits = credits - _cost WHERE id = OLD.reseller_id;
  INSERT INTO public.credit_transactions(reseller_id, actor_id, amount, reason)
  VALUES (OLD.reseller_id, coalesce(_actor, OLD.reseller_id), -_cost, 'Connections ' || OLD.username || ' (' || OLD.max_connections || ' → ' || NEW.max_connections || ', remaining months rounded up)');
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.bill_connection_increase() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER bill_line_connection_increase BEFORE UPDATE OF max_connections ON public.lines FOR EACH ROW EXECUTE FUNCTION public.bill_connection_increase();
CREATE OR REPLACE FUNCTION public.update_line(_line_id uuid, _password text, _custom_host text, _max_connections integer, _expires_at timestamptz DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _admin boolean; _line public.lines; _cost integer := 0;
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
  IF NOT _admin THEN _cost := public.connection_upgrade_cost(_line.expires_at, _line.max_connections, _max_connections, now()); END IF;
  UPDATE public.lines SET password = _password, custom_host = nullif(trim(_custom_host), ''), max_connections = _max_connections, expires_at = coalesce(_expires_at, expires_at) WHERE id = _line_id;
  RETURN _cost;
END;
$$;