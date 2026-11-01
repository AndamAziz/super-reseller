ALTER TABLE public.content_episodes ADD COLUMN provider_shared boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.content_episodes.provider_shared IS 'Explicit admin-approved sharing of this published episode with customers already authorised for its provider; ownership and editing policies remain unchanged.';
CREATE OR REPLACE FUNCTION public.guard_provider_episode_sharing()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $function$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.provider_shared) OR (TG_OP = 'UPDATE' AND NEW.provider_shared IS DISTINCT FROM OLD.provider_shared) THEN
    IF auth.role() = 'authenticated' AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
      RAISE EXCEPTION 'Only admins can change provider sharing' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.guard_provider_episode_sharing() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_provider_episode_sharing BEFORE INSERT OR UPDATE ON public.content_episodes FOR EACH ROW EXECUTE FUNCTION public.guard_provider_episode_sharing();