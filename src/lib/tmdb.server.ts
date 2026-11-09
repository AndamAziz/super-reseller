import type { VodKind, VodMetadata } from './vod';

export async function tmdbRequest(path: string, query = '') {
  const key = process.env['TMDB_API_KEY'];
  if (!key) throw new Error('TMDB key is not configured.');
  const url = new URL(`https://api.themoviedb.org/3/${path}`);
  url.searchParams.set('language', 'en-US');
  if (query) url.searchParams.set('query', query);
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (key.includes('.')) headers['Authorization'] = `Bearer ${key}`;
  else url.searchParams.set('api_key', key);
  let response: Response;
  try { response = await fetch(url, { headers, signal: AbortSignal.timeout(10000) }); }
  catch { throw new Error('TMDB is unavailable. Please try again.'); }
  if (!response.ok) throw new Error(response.status === 401 ? 'TMDB rejected the saved key.' : response.status === 429 ? 'TMDB is busy. Please try again shortly.' : 'TMDB could not load this title.');
  return response.json();
}

export async function tmdbDetails(kind: VodKind, id: number): Promise<VodMetadata> {
  const item = await tmdbRequest(`${kind}/${id}?append_to_response=external_ids`);
  return { media_type: kind, tmdb_id: item.id, title: item.title ?? item.name, overview: item.overview ?? '', poster_path: item.poster_path ?? null,
    release_date: item.release_date ?? item.first_air_date ?? '', imdb_id: item.imdb_id ?? item.external_ids?.imdb_id ?? null,
    seasons: (item.seasons ?? []).filter((s: { season_number: number }) => s.season_number > 0).map((s: { season_number: number; episode_count: number; name: string }) => ({ season_number: s.season_number, episode_count: s.episode_count, name: s.name })) };
}