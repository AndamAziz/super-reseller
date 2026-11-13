import { z } from 'zod';
import { vodEmbed, type VodEntry } from './vod';

export const vodSourceSchema = z.string().trim().max(4096).refine(value => {
  if (!value) return true;
  try {
    const u = new URL(value);
    return /^https?:$/.test(u.protocol) && /\.(mp4|m3u8)$/.test(u.pathname) && !u.username && !u.password && !u.hash && !/[\s"<>]/.test(value);
  } catch { return false; }
}, 'Enter a direct HTTP(S) .mp4 or .m3u8 URL, not an embed page.');

export function appendVodEntry(text: string, item: VodEntry): string {
  const source = vodSourceSchema.parse(item.source_url ?? '');
  if (!source) throw new Error('Add a playable source before publishing.');
  if (!/^\uFEFF?#EXTM3U/.test(text)) throw new Error('GitHub file is not an M3U playlist.');
  const key = `library-${item.media_type}-${item.tmdb_id}${item.media_type === 'tv' ? `-${item.season}-${item.episode}` : ''}`;
  const clean = (s: string) => s.replace(/[\r\n"]/g, ' ');
  const name = `${clean(item.title)} {tmdb-${item.tmdb_id}}${item.media_type === 'tv' ? ` - S${String(item.season).padStart(2, '0')}E${String(item.episode).padStart(2, '0')}` : ''}`;
  const nl = text.includes('\r\n') ? '\r\n' : '\n';
  const entry = `#EXTINF:-1 tvg-id="${key}" tvg-type="${item.media_type === 'movie' ? 'movie' : 'series'}" tmdb-id="${item.tmdb_id}" imdb-id="${clean(item.imdb_id ?? '')}" group-title="${item.media_type === 'movie' ? 'Movies' : 'Series'}" tvg-logo="${item.poster_path ? `https://image.tmdb.org/t/p/w500${clean(item.poster_path)}` : ''}" fallback-url="${vodEmbed(item)}",${name}${nl}${source}`;
  const lines = text.split(nl);
  const existing = lines.findIndex(l => l.startsWith('#EXTINF:') && l.includes(`tvg-id="${key}"`));
  if (existing >= 0) {
    let end = existing + 1;
    while (end < lines.length && !lines[end]?.startsWith('#EXTINF:')) end++;
    const current = lines.slice(existing, end).join(nl).trimEnd();
    if (current === entry) return text;
    throw new Error('This entry already exists with different details. Update it in GitHub to avoid overwriting saved content.');
  }
  return text + (text.endsWith(nl) ? '' : nl) + entry + nl;
}