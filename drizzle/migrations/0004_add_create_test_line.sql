CREATE OR REPLACE FUNCTION public.create_test_line(_username text, _password text)
RETURNS lines
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare _uid uuid := auth.uid(); _row public.lines;
begin
  if _uid is null then raise exception 'Not authenticated'; end if;
  if not public.has_role(_uid, 'admin') and not public.has_role(_uid, 'reseller') then
    raise exception 'Not allowed';
  end if;
  insert into public.lines(reseller_id, username, password, expires_at)
    values (_uid, trim(_username), _password, now() + interval '24 hours')
    returning * into _row;
  return _row;
end
$function$;

GRANT EXECUTE ON FUNCTION public.create_test_line(text, text) TO authenticated;