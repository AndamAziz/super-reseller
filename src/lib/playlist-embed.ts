import { mediaSection, type M3UChannel } from './m3u';

/** Source metadata only: no enrichment requests, ordinal IDs or credential forwarding. */
export function playlistEmbed(channel: M3UChannel): { url: string | null; reason?: string } {
  const section = mediaSection(channel);
  if (section === 'live') return { url: null };
  const attrs: Record<string, string> = {};
  const raw = channel.m3u_metadata?.extinf ?? '';
  let quote = ''; let end = raw.length;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === quote) quote = '';
    else if (!quote && (c === '"' || c === "'")) quote = c;
    else if (!quote && c === ',') { end = i; break; }
  }
  for (const m of raw.slice(0, end).matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s,]+))/g)) {
    if (m[1]) attrs[m[1].toLowerCase()] = (m[2] ?? m[3] ?? m[4] ?? '').trim();
  }
  const values = (...keys: string[]) => keys.map(key => attrs[key] ?? '');
  const imdb = [...values('imdb-id', 'tvg-imdb', 'imdb'), ...channel.name.match(/\btt\d{7,10}\b/gi) ?? []].find(v => /^tt\d{7,10}$/i.test(v));
  const numeric = (v: string) => /^\d+$/.test(v) && Number.isSafeInteger(Number(v)) && Number(v) > 0;
  const tmdb = [...values('tmdb-id', 'tvg-tmdb', 'tmdb'), /\{tmdb-(\d+)\}/i.exec(channel.name)?.[1] ?? ''].find(numeric);
  let sourcePath: RegExpExecArray | null = null;
  try { sourcePath = /\/(?:embed\/)?(movie|tv|series)\/(tt\d{7,10}|\d+)(?:\/(\d+)\/(\d+))?(?:\.[a-z0-9]+)?\/?$/i.exec(new URL(channel.url).pathname); } catch { /* No source identity inferred from arbitrary URLs. */ }
  const pathId = sourcePath && (section === 'movie' ? sourcePath[1] === 'movie' : sourcePath[1] !== 'movie') ? sourcePath[2] : '';
  const provider = [...values('provider-id', 'stream-id', 'tvg-id'), pathId ?? ''].find(v => numeric(v) || /^tt\d{7,10}$/i.test(v));
  const id = imdb?.toLowerCase() ?? tmdb ?? provider;
  if (!id) return { url: null, reason: 'No IMDb, TMDB or provider ID supplied for this item.' };
  const base = 'https://vaplayer.ru/embed';
  if (section === 'movie') return { url: `${base}/movie/${id}?color=e50914` };
  const code = /\bS(\d+)\s*E(\d+)\b/i.exec(channel.name) ?? /\b(\d{1,3})x(\d{1,4})\b/i.exec(channel.name);
  const season = [...values('season', 'season-number', 'tvg-season'), code?.[1] ?? '', sourcePath?.[3] ?? ''].find(numeric);
  const episode = [...values('episode', 'episode-number', 'tvg-episode'), code?.[2] ?? '', sourcePath?.[4] ?? ''].find(numeric);
  if (!season || !episode) return { url: null, reason: 'Season and episode numbers are missing or invalid.' };
  return { url: `${base}/tv/${id}/${Number(season)}/${Number(episode)}?color=e50914` };
}