import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { tmdbDetails, tmdbRequest } from './tmdb.server';
import type { VodEntry, VodKind, VodMetadata } from './vod';
import { vodSourceSchema } from './vod-source';

const identity = z.object({ media_type: z.enum(['movie', 'tv']), tmdb_id: z.number().int().positive() });
type AuthContext = { supabase: { rpc: (name: 'has_role', args: { _user_id: string; _role: 'admin' }) => PromiseLike<{ data: unknown; error: unknown }> }; userId: string };
async function requireAdmin(context: AuthContext) {
  const { data, error } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' });
  if (error || data !== true) throw new Error('Admins only.');
}
export const listVod = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }): Promise<VodEntry[]> => {
  await requireAdmin(context);
  const { data, error } = await context.supabase.from('vod_library').select('*').order('created_at', { ascending: false });
  if (error) throw new Error('Could not load the movie library.');
  return (data ?? []) as VodEntry[];
});
export const searchVod = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ media_type: z.enum(['movie', 'tv']), query: z.string().trim().min(2).max(120) }).parse(input))
  .handler(async ({ data, context }): Promise<VodMetadata[]> => {
    await requireAdmin(context);
    const results = await tmdbRequest(`search/${data.media_type}`, data.query);
    return (results.results ?? []).filter((item: { adult?: boolean }) => !item.adult).map((item: { id: number; title?: string; name?: string; overview?: string; poster_path?: string; release_date?: string; first_air_date?: string }) => ({ media_type: data.media_type as VodKind, tmdb_id: item.id, title: item.title ?? item.name ?? '', overview: item.overview ?? '', poster_path: item.poster_path ?? null, release_date: item.release_date ?? item.first_air_date ?? '', imdb_id: null, seasons: [] }));
  });
export const getVodDetails = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((input) => identity.parse(input))
  .handler(async ({ data, context }) => { await requireAdmin(context); return tmdbDetails(data.media_type, data.tmdb_id); });
export const saveVod = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input) => identity.extend({ season: z.number().int().positive().default(1), episode: z.number().int().positive().default(1), source_url: vodSourceSchema.default('') }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const metadata = await tmdbDetails(data.media_type, data.tmdb_id);
    if (data.media_type === 'tv') {
      const season = metadata.seasons.find(s => s.season_number === data.season);
      if (!season || data.episode > season.episode_count) throw new Error('Choose an existing season and episode.');
    }
    const { seasons: _seasons, ...fields } = metadata;
    const { error } = await context.supabase.from('vod_library').upsert({ ...fields, season: data.season, episode: data.episode, source_url: data.source_url || null }, { onConflict: 'media_type,tmdb_id' });
    if (error) throw new Error('Could not save this title.');
    return { ok: true };
  });
export const deleteVod = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => { await requireAdmin(context); const { error } = await context.supabase.from('vod_library').delete().eq('id', data.id); if (error) throw new Error('Could not remove this title.'); return { ok: true }; });

export const publishVod = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(input => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { data: item, error } = await context.supabase.from('vod_library').select('*').eq('id', data.id).single();
    if (error || !item?.source_url) throw new Error('Save a playable source first.');
    const { publishVodSource } = await import('./vod-github.server');
    return publishVodSource(item as VodEntry);
  });