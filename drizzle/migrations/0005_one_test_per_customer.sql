alter table public.lines add column if not exists customer_contact text, add column if not exists is_test boolean not null default false;

create table public.test_claims (
  customer_key text primary key,
  line_id uuid,
  reseller_id uuid not null,
  created_at timestamptz not null default now()
);
grant select on public.test_claims to authenticated;
grant all on public.test_claims to service_role;
alter table public.test_claims enable row level security;
create policy "admins read claims" on public.test_claims for select to authenticated using (public.has_role(auth.uid(),'admin'));

create or replace function public.normalize_customer(_c text) returns text language sql immutable set search_path = public as $$
  select lower(regexp_replace(coalesce(_c,''), '[\s\-\(\)\.]', '', 'g'))
$$;

create or replace function public.test_used(_customer text) returns jsonb language sql stable security definer set search_path = public as $$
  select case when auth.uid() is null then null else
    (select jsonb_build_object('used', true, 'at', created_at) from public.test_claims where customer_key = public.normalize_customer(_customer))
  end
$$;

drop function if exists public.create_test_line(text, text);
create or replace function public.create_test_line(_username text, _password text, _customer text)
returns public.lines language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _row public.lines; _key text := public.normalize_customer(_customer);
begin
  if _uid is null then raise exception 'Not authenticated'; end if;
  if not public.has_role(_uid,'admin') and not public.has_role(_uid,'reseller') then raise exception 'Not allowed'; end if;
  if length(_key) < 3 then raise exception 'Customer phone or ID is required for a test line'; end if;
  if exists (select 1 from public.test_claims where customer_key = _key) then
    raise exception 'This customer already used their free 24H test';
  end if;
  insert into public.lines(reseller_id, username, password, expires_at, customer_contact, is_test)
    values (_uid, trim(_username), _password, now() + interval '24 hours', trim(_customer), true)
    returning * into _row;
  insert into public.test_claims(customer_key, line_id, reseller_id) values (_key, _row.id, _uid);
  return _row;
end $$;
revoke execute on function public.create_test_line(text,text,text) from anon;
revoke execute on function public.test_used(text) from anon;