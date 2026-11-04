CREATE TABLE public.provider_catalog_cache (
 key text PRIMARY KEY,
 source_url text NOT NULL,
 etag text,
 catalog jsonb NOT NULL,
 checked_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.provider_catalog_cache TO authenticated;
GRANT ALL ON public.provider_catalog_cache TO service_role;
ALTER TABLE public.provider_catalog_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY provider_cache_admin_read ON public.provider_catalog_cache FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TABLE public.provider_request_logs (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 created_at timestamptz NOT NULL DEFAULT now(),
 request_type text NOT NULL,
 duration_ms integer NOT NULL,
 status integer NOT NULL,
 timed_out boolean NOT NULL DEFAULT false
);
GRANT SELECT ON public.provider_request_logs TO authenticated;
GRANT ALL ON public.provider_request_logs TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.provider_request_logs_id_seq TO service_role;
ALTER TABLE public.provider_request_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY provider_logs_admin_read ON public.provider_request_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX provider_request_logs_created_idx ON public.provider_request_logs (created_at);
CREATE INDEX provider_request_logs_duration_idx ON public.provider_request_logs (duration_ms DESC);
CREATE INDEX IF NOT EXISTS active_connections_line_last_seen_idx ON public.active_connections (line_id, last_seen);
CREATE FUNCTION public.prune_provider_request_logs() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
 DELETE FROM public.provider_request_logs WHERE id IN (SELECT id FROM public.provider_request_logs WHERE created_at < now() - interval '24 hours' ORDER BY created_at LIMIT 5000);
$$;
REVOKE ALL ON FUNCTION public.prune_provider_request_logs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_provider_request_logs() TO service_role;