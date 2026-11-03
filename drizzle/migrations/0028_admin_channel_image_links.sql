CREATE TABLE public.image_links (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 url text NOT NULL,
 path text NOT NULL UNIQUE,
 original_name text NOT NULL,
 format text NOT NULL CHECK (format IN ('webp','png','jpg')),
 width integer NOT NULL CHECK (width > 0),
 height integer NOT NULL CHECK (height > 0),
 size_bytes bigint NOT NULL CHECK (size_bytes > 0),
 created_by uuid NOT NULL DEFAULT auth.uid(),
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.image_links TO authenticated;
GRANT ALL ON public.image_links TO service_role;
ALTER TABLE public.image_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY image_links_admin_select ON public.image_links FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY image_links_admin_insert ON public.image_links FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') AND created_by = auth.uid());
CREATE POLICY image_links_admin_delete ON public.image_links FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY channel_images_public_read ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'channel-images');
CREATE POLICY channel_images_admin_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'channel-images' AND public.has_role(auth.uid(), 'admin') AND name ~ '^[a-f0-9]{16}\.(webp|png|jpg)$');
CREATE POLICY channel_images_admin_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'channel-images' AND public.has_role(auth.uid(), 'admin')) WITH CHECK (bucket_id = 'channel-images' AND public.has_role(auth.uid(), 'admin') AND name ~ '^[a-f0-9]{16}\.(webp|png|jpg)$');
CREATE POLICY channel_images_admin_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'channel-images' AND public.has_role(auth.uid(), 'admin'));