import { z } from 'zod';

export function youtubeId(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.port || url.username || url.password) return null;
    let id: string | null = null;
    if (url.hostname === 'youtu.be') id = /^\/([\w-]{11})$/.exec(url.pathname)?.[1] ?? null;
    if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname)) {
      if (url.pathname === '/watch' && url.searchParams.getAll('v').length === 1) id = url.searchParams.get('v');
      else id = /^\/(?:embed|live)\/([\w-]{11})$/.exec(url.pathname)?.[1] ?? null;
    }
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}

export const episodeCode = (season: number, episode: number) => `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;
export const posterSchema = z.string().trim().max(4000).refine(v => !v || /^https:\/\/\S+$/.test(v), 'Use an HTTPS poster URL').transform(v => v || null);
export const seriesSchema = z.object({ id: z.string().uuid().optional(), title: z.string().trim().min(1).max(300), category: z.string().trim().min(1).max(200).default('YouTube'), poster_url: posterSchema, description: z.string().max(10000).default(''), source_identity: z.string().max(1000).optional() });
export const seasonSchema = z.object({ series_id: z.string().uuid(), season_number: z.number().int().min(1).max(999) });
export const episodeSchema = z.object({
  id: z.string().uuid().optional(), season_id: z.string().uuid(), episode_number: z.number().int().min(1).max(9999),
  title: z.string().trim().min(1, 'Enter an episode title').max(300),
  original_url: z.string().trim().max(4000).refine(v => youtubeId(v) !== null, 'Enter a supported HTTPS YouTube watch, short, embed or live URL'),
  poster_url: posterSchema, description: z.string().max(10000).default(''),
  release_date: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal('')]).transform(v => v || null), published: z.boolean(),
});
export function youtubePlayerError(code: number): string {
  if (code === 100) return 'This video is private, deleted or unavailable.';
  if (code === 101 || code === 150) return 'The owner does not permit embedded playback.';
  if (code === 153) return 'YouTube could not verify this player. Open the video on YouTube.';
  if (code === 2) return 'This video URL is invalid.';
  return 'YouTube playback is unavailable. Restrictions or a connection problem may apply.';
}