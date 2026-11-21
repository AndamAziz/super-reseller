CREATE OR REPLACE FUNCTION public.test_used(_customer text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case when auth.uid() is null
    or not (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'reseller')) then null else
    (select jsonb_build_object('used', true) from public.test_claims where customer_key = public.normalize_customer(_customer))
  end
$function$;
REVOKE EXECUTE ON FUNCTION public.test_used(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.test_used(text) TO authenticated;