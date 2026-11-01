CREATE POLICY "Admins replace own public MP4 videos" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'public-videos' AND public.has_role(auth.uid(), 'admin'::public.app_role) AND (storage.foldername(name))[1] = auth.uid()::text AND lower(storage.extension(name)) = 'mp4')
WITH CHECK (bucket_id = 'public-videos' AND public.has_role(auth.uid(), 'admin'::public.app_role) AND (storage.foldername(name))[1] = auth.uid()::text AND lower(storage.extension(name)) = 'mp4');