ALTER TABLE public.lines ADD COLUMN IF NOT EXISTS panel_status text NOT NULL DEFAULT 'local';
ALTER TABLE public.lines ADD COLUMN IF NOT EXISTS panel_message text;