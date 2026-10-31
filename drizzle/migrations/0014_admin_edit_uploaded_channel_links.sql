GRANT UPDATE (url, logo) ON public.channels TO authenticated;
CREATE POLICY "admin update channel links" ON public.channels
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));