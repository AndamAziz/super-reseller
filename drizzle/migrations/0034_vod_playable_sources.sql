ALTER TABLE public.vod_library ADD COLUMN source_url text;
ALTER TABLE public.vod_library ADD CONSTRAINT vod_source_url_format CHECK (source_url IS NULL OR (length(source_url) <= 4096 AND source_url ~ '^https?://[^[:space:]]+\.(mp4|m3u8)(\?[^[:space:]]*)?$'));
COMMENT ON COLUMN public.vod_library.source_url IS 'Admin-supplied authorized direct MP4/M3U8 source; iframe pages are not media.';