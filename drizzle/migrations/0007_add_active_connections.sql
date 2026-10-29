CREATE TABLE public.active_connections (
  line_id uuid NOT NULL REFERENCES public.lines(id) ON DELETE CASCADE,
  client_key text NOT NULL,
  last_seen timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (line_id, client_key)
);

GRANT SELECT ON public.active_connections TO authenticated;
GRANT ALL ON public.active_connections TO service_role;

ALTER TABLE public.active_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read all connections"
ON public.active_connections FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Resellers can read own connections"
ON public.active_connections FOR SELECT TO authenticated
USING (line_id IN (SELECT id FROM public.lines WHERE reseller_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.check_stream_limit(_line_id uuid, _client_key text, _max integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_count integer;
BEGIN
  DELETE FROM public.active_connections WHERE last_seen < now() - interval '90 seconds';
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
$$;