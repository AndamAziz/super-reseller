ALTER TABLE public.lines DROP CONSTRAINT lines_max_connections_check;
ALTER TABLE public.lines ADD CONSTRAINT lines_max_connections_check CHECK (max_connections >= 1 AND max_connections <= 100);