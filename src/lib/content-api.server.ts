import { z } from 'zod';
import { authLine, json, loadCatalog } from './playlist-auth.server';
import { displayPoster } from './content-posters.server';
import { episodeCode } from './youtube';
import { playlistVersion } from './playlist-version';
import { collectContentPages } from './content-pagination';
import { mergeProviderCatalog } from './provider-catalog';

const contentId = z.string().max(300).refine(v => z.string().uuid().safeParse(v).success || /^m3u:github:[a-zA-Z0-9:]+$/.test(v));
const requestSchema = z.object({ action: z.enum(['catalog', 'series', 'series_details', 'seasons', 'episodes', 'episode', 'playback']).default('catalog'), series_id: contentId.optional(), season_number: z.coerce.number().int().positive().optional(), episode_id: contentId.optional(), provider_key: z.string().optional(), language: z.string().max(200).optional() });

export async function handleContentApi(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  // POST credentials avoid embedding customer passwords in URLs and request logs.
  let credentials: { username?: string; password?: string } = {};
  if (request.method === 'POST') {
    try { credentials = z.object({ username: z.string().max(50), password: z.string().max(100) }).parse(await request.json()); }
    catch { return json({ error: 'Invalid request' }, 400); }
  }
  const auth = await authLine(credentials.username ?? params.get('username') ?? '', credentials.password ?? params.get('password') ?? '');
  if (!auth.ok) return json({ error: auth.message }, auth.status);
  const parsed = requestSchema.safeParse(Object.fromEntries([...params].filter(([key]) => !['username', 'password'].includes(key))));
  if (!parsed.success) return json({ error: 'Invalid content request' }, 400);
  const { action, series_id, season_number, episode_id, provider_key, language } = parsed.data;
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  // Resolve ownership from the authenticated line, never from caller-supplied IDs.
  const { data: line, error: lineError } = await supabaseAdmin.from('lines').select('reseller_id').eq('id', auth.lineId).single();
  if (lineError || !line) return json({ error: 'Content unavailable' }, 503);
  const records = await Promise.all([
    collectContentPages((from, to) => supabaseAdmin.from('content_series').select('id,title,category,poster_url,description,source_identity,english_name,original_name,tmdb_id,provider_key,updated_at').eq('owner_id', line.reseller_id).order('title').order('id').range(from, to)),
    collectContentPages((from, to) => supabaseAdmin.from('content_seasons').select('id,series_id,season_number,created_at').eq('owner_id', line.reseller_id).order('season_number').order('id').range(from, to)),
    collectContentPages((from, to) => supabaseAdmin.from('content_episodes').select('id,series_id,season_id,season_number,episode_number,title,youtube_video_id,original_url,poster_url,description,release_date,language_label,source_type,updated_at').eq('owner_id', line.reseller_id).eq('published', true).order('season_number').order('episode_number').order('id').range(from, to)),
  ]).catch(() => null);
  if (!records) return json({ error: 'Content temporarily unavailable' }, 503);
  const [allSeries, n, allEpisodes] = records;
  const s = allSeries.filter(x => !provider_key || x.provider_key === provider_key);
  const e = allEpisodes.filter(x => s.some(y => y.id === x.series_id) && (!language || x.language_label === language));
  const visibleSeries = s.filter(x => e.some(y => y.series_id === x.id));
  const visibleSeasons = n.filter(x => e.some(y => y.season_id === x.id));
  // Hash raw records before signing posters so a new signed URL does not fake a content update.
  const loaded = !provider_key || provider_key === 'github' ? await loadCatalog() : null;
  if (loaded && !loaded.ok) return json({ error: 'Provider catalogue temporarily unavailable' }, 503);
  const revision = await playlistVersion(JSON.stringify([visibleSeries, visibleSeasons, e, loaded?.ok ? loaded.catalog.version ?? loaded.catalog.series : null]));
  const managedSeries = await Promise.all(visibleSeries.map(async x => ({ ...x, poster_url: await displayPoster(supabaseAdmin, x.poster_url, line.reseller_id) })));
  const managedEpisodes = await Promise.all(e.map(async x => {
    const parent = managedSeries.find(y => y.id === x.series_id);
    return { ...x, episode_code: episodeCode(x.season_number, x.episode_number), poster_url: await displayPoster(supabaseAdmin, x.poster_url, line.reseller_id) ?? parent?.poster_url ?? null,
      playback: { source_type: 'youtube' as const, youtube_video_id: x.youtube_video_id, embed_url: `https://www.youtube.com/embed/${x.youtube_video_id}`, original_url: x.original_url } };
  }));
  const combined = mergeProviderCatalog(loaded?.ok ? loaded.catalog.series : [], { series: managedSeries, seasons: visibleSeasons, episodes: managedEpisodes }, { origin: new URL(request.url).origin, username: auth.username, password: auth.password });
  const episodes = combined.episodes.filter(x => !language || x.language_label === language);
  const series = combined.series.filter(x => episodes.some(y => y.series_id === x.id));
  const combinedSeasons = combined.seasons.filter(x => episodes.some(y => y.season_id === x.id));
  const envelope = { schema_version: 1, revision, refresh_after_seconds: 5, poster_url_expires_in_seconds: 3600 };
  const selected = series.find(x => x.id === series_id);
  const episode = episodes.find(x => x.id === episode_id);
  if (action === 'series') return json({ ...envelope, series });
  if (action === 'series_details' || action === 'seasons' || action === 'episodes') {
    if (!selected) return json({ error: 'Series not found' }, 404);
    const seasons = combinedSeasons.filter(x => x.series_id === series_id);
    const matching = episodes.filter(x => x.series_id === series_id && (!season_number || x.season_number === season_number));
    return json({ ...envelope, series: selected, seasons, episodes: action === 'seasons' ? undefined : matching });
  }
  if (action === 'episode' || action === 'playback') {
    if (!episode) return json({ error: 'Episode not found' }, 404);
    return json({ ...envelope, episode: action === 'episode' ? episode : undefined, playback: episode.playback });
  }
  return json({ ...envelope, series, seasons: combinedSeasons, episodes });
}