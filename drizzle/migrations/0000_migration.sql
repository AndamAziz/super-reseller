create type public.app_role as enum ('admin', 'reseller');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create policy "own roles or admin" on public.user_roles for select to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create table public.profiles (
  id uuid primary key,
  email text not null,
  display_name text,
  credits integer not null default 0 check (credits >= 0),
  created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile or admin" on public.profiles for select to authenticated
using (id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "admin updates profiles" on public.profiles for update to authenticated
using (public.has_role(auth.uid(), 'admin'));

create table public.lines (
  id uuid primary key default gen_random_uuid(),
  reseller_id uuid not null references public.profiles(id) on delete cascade,
  username text not null unique check (char_length(username) between 3 and 50),
  password text not null check (char_length(password) between 4 and 100),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
grant select, delete on public.lines to authenticated;
grant all on public.lines to service_role;
alter table public.lines enable row level security;
create policy "own lines or admin read" on public.lines for select to authenticated
using (reseller_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "own lines or admin delete" on public.lines for delete to authenticated
using (reseller_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create table public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  reseller_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid,
  amount integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);
grant select on public.credit_transactions to authenticated;
grant all on public.credit_transactions to service_role;
alter table public.credit_transactions enable row level security;
create policy "own tx or admin" on public.credit_transactions for select to authenticated
using (reseller_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create table public.playlists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel_count integer not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.playlists to authenticated;
grant all on public.playlists to service_role;
alter table public.playlists enable row level security;
create policy "auth read playlists" on public.playlists for select to authenticated using (true);
create policy "admin write playlists" on public.playlists for all to authenticated
using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  position integer not null default 0,
  name text not null,
  group_title text,
  logo text,
  url text not null,
  referrer text
);
create index on public.channels(playlist_id, position);
grant select, insert, delete on public.channels to authenticated;
grant all on public.channels to service_role;
alter table public.channels enable row level security;
create policy "auth read channels" on public.channels for select to authenticated using (true);
create policy "admin insert channels" on public.channels for insert to authenticated
with check (public.has_role(auth.uid(), 'admin'));
create policy "admin delete channels" on public.channels for delete to authenticated
using (public.has_role(auth.uid(), 'admin'));

-- Credit logic: 1 credit = 1 month. Admin creates lines for free.
create or replace function public.create_line(_username text, _password text, _months integer)
returns public.lines language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _is_admin boolean; _bal integer; _row public.lines;
begin
  if _uid is null then raise exception 'Not authenticated'; end if;
  if _months is null or _months < 1 or _months > 24 then raise exception 'Months must be between 1 and 24'; end if;
  _is_admin := public.has_role(_uid, 'admin');
  if not _is_admin and not public.has_role(_uid, 'reseller') then raise exception 'Not allowed'; end if;
  if not _is_admin then
    select credits into _bal from public.profiles where id = _uid for update;
    if _bal is null or _bal < _months then raise exception 'Insufficient credits (need %, have %)', _months, coalesce(_bal,0); end if;
    update public.profiles set credits = credits - _months where id = _uid;
    insert into public.credit_transactions(reseller_id, actor_id, amount, reason)
      values (_uid, _uid, -_months, 'New line ' || _username || ' (' || _months || ' mo)');
  end if;
  insert into public.lines(reseller_id, username, password, expires_at)
    values (_uid, trim(_username), _password, now() + make_interval(months => _months))
    returning * into _row;
  return _row;
end $$;

create or replace function public.renew_line(_line_id uuid, _months integer)
returns public.lines language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _is_admin boolean; _line public.lines; _bal integer;
begin
  if _uid is null then raise exception 'Not authenticated'; end if;
  if _months is null or _months < 1 or _months > 24 then raise exception 'Months must be between 1 and 24'; end if;
  _is_admin := public.has_role(_uid, 'admin');
  select * into _line from public.lines where id = _line_id for update;
  if _line.id is null then raise exception 'Line not found'; end if;
  if not _is_admin and _line.reseller_id <> _uid then raise exception 'Not allowed'; end if;
  if not _is_admin then
    select credits into _bal from public.profiles where id = _uid for update;
    if _bal < _months then raise exception 'Insufficient credits (need %, have %)', _months, _bal; end if;
    update public.profiles set credits = credits - _months where id = _uid;
    insert into public.credit_transactions(reseller_id, actor_id, amount, reason)
      values (_uid, _uid, -_months, 'Renew ' || _line.username || ' (' || _months || ' mo)');
  end if;
  update public.lines set expires_at = greatest(expires_at, now()) + make_interval(months => _months)
    where id = _line_id returning * into _line;
  return _line;
end $$;

create or replace function public.adjust_credits(_reseller_id uuid, _amount integer, _reason text)
returns integer language plpgsql security definer set search_path = public as $$
declare _bal integer;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Admins only'; end if;
  if _amount = 0 then raise exception 'Amount cannot be zero'; end if;
  select credits into _bal from public.profiles where id = _reseller_id for update;
  if _bal is null then raise exception 'Reseller not found'; end if;
  if _bal + _amount < 0 then raise exception 'Balance cannot go below zero'; end if;
  update public.profiles set credits = credits + _amount where id = _reseller_id returning credits into _bal;
  insert into public.credit_transactions(reseller_id, actor_id, amount, reason)
    values (_reseller_id, auth.uid(), _amount, coalesce(nullif(trim(_reason),''), case when _amount > 0 then 'Credits added' else 'Credits removed' end));
  return _bal;
end $$;

revoke execute on function public.create_line, public.renew_line, public.adjust_credits from anon, public;
grant execute on function public.create_line, public.renew_line, public.adjust_credits to authenticated;