import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { episodeSchema, seasonSchema, seriesSchema, youtubeId, providerEpisodeSchema } from './youtube';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { collectContentPages } from './content-pagination';

async function member(client: SupabaseClient<Database>, userId: string) {
  const { data, error } = await client.from('user_roles').select('role').eq('user_id', userId);
  if (error || !data?.some(r => r.role === 'admin' || r.role === 'reseller')) throw new Error('Access denied');
}
function failure(error: { code?: string; message: string } | null) {
  if (!error) return;
  if (error.code === '23505') throw new Error('This season or episode number already exists. Edit the existing record instead.');
  throw new Error('Could not save content. Check your permissions and entered information.');
}

export const getManagedContent = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await member(context.supabase, context.userId);
  const [s, n, e] = await Promise.all([
    collectContentPages((from, to) => context.supabase.from('content_series').select('*').order('title').order('id').range(from, to)),
    collectContentPages((from, to) => context.supabase.from('content_seasons').select('*').order('season_number').order('id').range(from, to)),
    collectContentPages((from, to) => context.supabase.from('content_episodes').select('*').order('season_number').order('episode_number').order('id').range(from, to)),
  ]);
  const { displayPoster } = await import('./content-posters.server');
  return { series: await Promise.all(s.map(async x => ({ ...x, display_poster: await displayPoster(context.supabase, x.poster_url, x.owner_id) }))), seasons: n,
    episodes: await Promise.all(e.map(async x => ({ ...x, display_poster: await displayPoster(context.supabase, x.poster_url, x.owner_id) }))) };
});

export const addProviderEpisode = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(v => providerEpisodeSchema.parse(v)).handler(async ({ data, context }) => {
  await member(context.supabase, context.userId);
  const videoId = youtubeId(data.original_url);
  if (!videoId) throw new Error('Invalid YouTube URL');
  const result = await context.supabase.rpc('add_provider_youtube_episode', {
    _owner_id: data.owner_id, _provider_key: data.provider_key, _english_name: data.english_name, _original_name: data.original_name,
    _tmdb_id: data.tmdb_id, _season_number: data.season_number, _episode_number: data.episode_number,
    _language_label: data.language_label, _original_url: data.original_url, _video_id: videoId, _poster_url: data.poster_url,
  });
  if (result.error?.message.includes('existing names')) throw new Error('Use the existing English and original names for this TMDB series.');
  failure(result.error);
  return { id: result.data };
});

export const saveSeries = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(v => seriesSchema.parse(v)).handler(async ({ data, context }) => {
  await member(context.supabase, context.userId);
  const { id, source_identity, ...fields } = data;
  const result = id ? await context.supabase.from('content_series').update(fields).eq('id', id).select('id').single()
    : await context.supabase.from('content_series').insert({ ...fields, owner_id: context.userId, source_identity: source_identity ?? null }).select('id').single();
  failure(result.error); return result.data;
});
export const addSeason = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(v => seasonSchema.parse(v)).handler(async ({ data, context }) => {
  await member(context.supabase, context.userId);
  const { data: parent } = await context.supabase.from('content_series').select('owner_id').eq('id', data.series_id).single();
  if (!parent) throw new Error('Series not accessible');
  const result = await context.supabase.from('content_seasons').insert({ ...data, owner_id: parent.owner_id }).select('id').single();
  failure(result.error); return result.data;
});
export const saveEpisode = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(v => episodeSchema.parse(v)).handler(async ({ data, context }) => {
  await member(context.supabase, context.userId);
  const { data: season } = await context.supabase.from('content_seasons').select('*').eq('id', data.season_id).single();
  if (!season) throw new Error('Season not accessible');
  const { id, season_id, ...fields } = data;
  const videoId = youtubeId(data.original_url);
  if (!videoId) throw new Error('Invalid YouTube URL');
  const values = { ...fields, youtube_video_id: videoId };
  const result = id ? await context.supabase.from('content_episodes').update(values).eq('id', id).eq('season_id', season_id).select('id').single()
    : await context.supabase.from('content_episodes').insert({ ...values, season_id, series_id: season.series_id, season_number: season.season_number, owner_id: season.owner_id }).select('id').single();
  failure(result.error); return result.data;
});
export const deleteContent = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(v => z.object({ type: z.enum(['episode', 'series', 'season']), id: z.string().uuid() }).parse(v)).handler(async ({ data, context }) => {
  await member(context.supabase, context.userId);
  const table = data.type === 'episode' ? 'content_episodes' : data.type === 'season' ? 'content_seasons' : 'content_series';
  const result = await context.supabase.from(table).delete().eq('id', data.id).select('id').single();
  failure(result.error); return { ok: true };
});
export const getYoutubeMetadata = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(v => z.object({ url: z.string().max(4000).refine(v => youtubeId(v) !== null) }).parse(v)).handler(async ({ data, context }) => {
  await member(context.supabase, context.userId);
  const id = youtubeId(data.url);
  try {
    const endpoint = new URL('https://www.youtube.com/oembed');
    endpoint.searchParams.set('url', `https://www.youtube.com/watch?v=${id}`); endpoint.searchParams.set('format', 'json');
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(8000), redirect: 'error' });
    if (!response.ok) return { title: null, poster: null, error: 'Metadata unavailable. Enter the details manually.' };
    const result = z.object({ title: z.string().max(1000), thumbnail_url: z.string().url() }).parse(await response.json());
    return { title: result.title.slice(0, 300), poster: result.thumbnail_url.startsWith('https://') ? result.thumbnail_url : null, error: null };
  } catch { return { title: null, poster: null, error: 'Metadata unavailable. Enter the details manually.' }; }
});
export const getExistingSeries = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await member(context.supabase, context.userId);
  const { loadCatalog } = await import('./playlist-auth.server');
  const loaded = await loadCatalog();
  return loaded.ok ? loaded.catalog.series.map(s => ({ title: s.title, category: s.category, poster_url: s.cover, source_identity: JSON.stringify([s.title, s.category]) })) : [];
});