import type { M3UChannel } from './m3u';

/** Read only source-declared metadata; never fetch TMDB per catalogue row. */
export function providerMetadata(channel: M3UChannel) {
  const attrs: Record<string, string> = {};
  const raw = channel.m3u_metadata?.extinf ?? '';
  // Stop at the unquoted title separator, not commas inside poster URLs.
  let quote = ''; let end = raw.length;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (quote === c) quote = '';
    else if (!quote && (c === '"' || c === "'")) quote = c;
    else if (!quote && c === ',') { end = i; break; }
  }
  for (const m of raw.slice(0, end).matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s,]+))/g)) {
    if (m[1]) attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  const value = (...keys: string[]) => keys.map(k => attrs[k]).find(v => v?.trim()) ?? '';
  const id = value('tmdb-id', 'tvg-tmdb', 'tmdb') || /\{tmdb-(\d+)\}/i.exec(channel.name)?.[1] || '';
  const tmdb = /^\d+$/.test(id) && Number.isSafeInteger(Number(id)) && Number(id) > 0 ? Number(id) : null;
  const rating = value('rating', 'tvg-rating');
  return {
    ...(tmdb === null ? {} : { tmdb_id: tmdb, tmdb }),
    plot: value('plot', 'description', 'tvg-description'), cast: value('cast'), director: value('director'),
    genre: value('genre'), releaseDate: value('release-date', 'releasedate', 'year'), rating,
    rating_5based: Number.isFinite(Number(rating)) ? Math.min(5, Math.max(0, Number(rating) / 2)) : 0,
    duration: value('duration'), language: value('audio-language', 'language', 'tvg-language'),
    subtitle_language: value('subtitle-language', 'subtitles'),
  };
}