export type VodKind = 'movie' | 'tv';
export type VodMetadata = { media_type: VodKind; tmdb_id: number; title: string; overview: string; poster_path: string | null; release_date: string; imdb_id: string | null; seasons: { season_number: number; episode_count: number; name: string }[] };
export type VodEntry = Omit<VodMetadata, 'seasons'> & { id: string; season: number; episode: number; created_at: string };
export function vodEmbed(item: Pick<VodEntry, 'media_type' | 'tmdb_id' | 'imdb_id' | 'season' | 'episode'>) {
  const id = item.imdb_id && /^tt\d{7,10}$/.test(item.imdb_id) ? item.imdb_id : String(item.tmdb_id);
  if (!Number.isSafeInteger(item.tmdb_id) || item.tmdb_id < 1) throw new Error('Invalid TMDB identity');
  if (item.media_type === 'tv' && (!Number.isInteger(item.season) || item.season < 1 || !Number.isInteger(item.episode) || item.episode < 1)) throw new Error('Invalid episode');
  return `https://vaplayer.ru/embed/${item.media_type === 'movie' ? `movie/${id}` : `tv/${id}/${item.season}/${item.episode}`}?color=e50914`;
}
export const vodLibraryKey = ['vod-library'];