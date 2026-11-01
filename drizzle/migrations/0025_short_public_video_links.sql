update storage.objects
set name = '2bce34f8-9310-4b4a-a6b4-b7a481fe0d05/video-2026-11-01.mp4'
where bucket_id = 'public-videos'
  and name = '2bce34f8-9310-4b4a-a6b4-b7a481fe0d05/7537981d-2352-4e3d-aa99-1e96829cb26c_video_2026-11-01_05-43-18.mp4';

create or replace function public.public_video_path(p_short text)
returns text
language sql stable security definer
set search_path = public, storage
as $$
  select o.name from storage.objects o
  where o.bucket_id = 'public-videos'
    and regexp_replace(split_part(o.name, '/', 2), '^[0-9a-f-]{36}_', '') = p_short
  order by o.created_at desc
  limit 1;
$$;
revoke all on function public.public_video_path(text) from public;
grant execute on function public.public_video_path(text) to anon, authenticated;