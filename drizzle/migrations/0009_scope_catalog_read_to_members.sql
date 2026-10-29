DROP POLICY "auth read playlists" ON public.playlists;
CREATE POLICY "members read playlists"
ON public.playlists FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()));

DROP POLICY "auth read channels" ON public.channels;
CREATE POLICY "members read channels"
ON public.channels FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()));