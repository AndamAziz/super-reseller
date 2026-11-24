-- The Playlists page reads the stored catalog straight from the browser (no Worker CPU), so the
-- same roles that could call getSourcePlaylist (admin or reseller) may read the cached row.
DROP POLICY IF EXISTS provider_cache_admin_read ON public.provider_catalog_cache;
CREATE POLICY provider_cache_member_read ON public.provider_catalog_cache FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'reseller'));
