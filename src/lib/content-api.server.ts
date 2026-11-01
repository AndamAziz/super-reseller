import { z } from 'zod';
import { authLine, json } from './playlist-auth.server';
import { displayPoster } from './content-posters.server';
import { episodeCode } from './youtube';
import { playlistVersion } from './playlist-version';

const requestSchema = z.object({ action: z.enum(['catalog', 'series', 'series_details', 'seasons', 'episodes', 'episode', 'playback']).default('catalog'), series_id: z.string().uuid().optional(), season_number: z.coerce.number().int().positive().optional(), episode_id: z.string().uuid().optional() });

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
  const { action, series_id, season_number, episode_id } = parsed.data;
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  // Resolve ownership from the authenticated line, never from caller-supplied IDs.
  const { data: line, error: lineError } = await supabaseAdmin.from('lines').select('reseller_id').eq('id', auth.lineId).single();
  if (lineError || !line) return json({ error: 'Content unavailable' }, 503);
  const [s, n, e] = await Promise.all([
    supabaseAdmin.from('content_series').select('id,title,category,poster_url,description,source_identity,updated_at').eq('owner_id', line.reseller_id).order('title'),
    supabaseAdmin.from('content_seasons').select('id,series_id,season_number,created_at').eq('owner_id', line.reseller_id).order('season_number'),
    supabaseAdmin.from('content_episodes').select('id,series_id,season_id,season_number,episode_number,title,youtube_video_id,original_url,poster_url,description,release_date,source_type,updated_at').eq('owner_id', line.reseller_id).eq('published', true).order('season_number').order('episode_number'),
  ]);
  if (s.error || n.error || e.error) return json({ error: 'Content temporarily unavailable' }, 503);
  const visibleSeries = s.data.filter(x => e.data.some(y => y.series_id === x.id));
  const visibleSeasons = n.data.filter(x => e.data.some(y => y.season_id === x.id));
  // Hash raw records before signing posters so a new signed URL does not fake a content update.
  const revision = await playlistVersion(JSON.stringify([visibleSeries, visibleSeasons, e.data]));
  const series = await Promise.all(visibleSeries.map(async x => ({ ...x, poster_url: await displayPoster(supabaseAdmin, x.poster_url, line.reseller_id) })));
  const episodes = await Promise.all(e.data.map(async x => {
    const parent = series.find(y => y.id === x.series_id);
    return { ...x, episode_code: episodeCode(x.season_number, x.episode_number), poster_url: await displayPoster(supabaseAdmin, x.poster_url, line.reseller_id) ?? parent?.poster_url ?? null,
      playback: { source_type: 'youtube' as const, youtube_video_id: x.youtube_video_id, embed_url: `https://www.youtube.com/embed/${x.youtube_video_id}`, original_url: x.original_url } };
  }));
  const envelope = { schema_version: 1, revision, refresh_after_seconds: 5, poster_url_expires_in_seconds: 3600 };
  const selected = series.find(x => x.id === series_id);
  const episode = episodes.find(x => x.id === episode_id);
  if (action === 'series') return json({ ...envelope, series });
  if (action === 'series_details' || action === 'seasons' || action === 'episodes') {
    if (!selected) return json({ error: 'Series not found' }, 404);
    const seasons = visibleSeasons.filter(x => x.series_id === series_id);
    const matching = episodes.filter(x => x.series_id === series_id && (!season_number || x.season_number === season_number));
    return json({ ...envelope, series: selected, seasons, episodes: action === 'seasons' ? undefined : matching });
  }
  if (action === 'episode' || action === 'playback') {
    if (!episode) return json({ error: 'Episode not found' }, 404);
    return json({ ...envelope, episode: action === 'episode' ? episode : undefined, playback: episode.playback });
  }
  return json({ ...envelope, series, seasons: visibleSeasons, episodes });
}