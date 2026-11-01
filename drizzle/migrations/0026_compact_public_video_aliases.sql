CREATE OR REPLACE FUNCTION public.public_video_path(p_short text)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, storage
AS $$
  SELECT min(o.name) FROM storage.objects o
  WHERE o.bucket_id = 'public-videos'
    AND (regexp_replace(split_part(o.name, '/', 2), '^[0-9a-f-]{36}_', '') = p_short
      OR 'v-' || left(encode(sha256(convert_to(o.name, 'UTF8')), 'hex'), 12) || '.mp4' = p_short)
  HAVING count(*) = 1;
$$;
REVOKE ALL ON FUNCTION public.public_video_path(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_video_path(text) TO anon, authenticated, service_role;