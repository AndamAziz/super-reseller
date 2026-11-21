import type { Catalog } from './playlist-auth.server';
import { playbackUrl } from './media';
import { providerMetadata } from './provider-metadata';
import { portalPage } from './mac-portal';

export type PortalAccount = { lineId: string; id: number; username: string; password: string; mac: string; expiresAt: string; maxConnections: number };
export function portalCatalogResponse(catalog: Catalog, params: URLSearchParams, account: PortalAccount, origin: string): unknown {
  const type = params.get('type'), action = params.get('action');
  const cats = (items: { group_title?: string | null; category?: string }[]) => [...new Set(items.map(x => x.category ?? x.group_title ?? 'Uncategorized'))];
  const groups = cats(type === 'itv' ? catalog.live : type === 'vod' ? catalog.movies : catalog.series);
  if (action === 'get_genres' || action === 'get_categories') return groups.map((title, i) => ({ id: String(i + 1), title, alias: title }));
  const category = params.get(type === 'itv' ? 'genre' : 'category');
  const allowed = (group: string | null) => !category || category === '*' || category === '0' || String(groups.indexOf(group ?? 'Uncategorized') + 1) === category;
  const page = Number(params.get('p') ?? 1);
  const ids = stableSeriesIds(catalog.series);
  const link = (kind: 'live' | 'movie' | 'series', id: number, item: Catalog['live'][number]) => playbackUrl(origin, kind, account.username, account.password, id, item.url, item);
  if (action === 'create_link') {
    // Never echo or fetch arbitrary caller URLs. Commands only select saved catalog IDs.
    const cmd = params.get('cmd') ?? '';
    const seasonCmd = type !== 'itv' ? /^\/season\/(\d+):(\d+)\.mp4$/.exec(cmd) : null;
    const episodeCmd = type !== 'itv' ? /^\/series\/(\d+):(\d+):(\d+)\.mp4$/.exec(cmd) : null;
    if (seasonCmd || episodeCmd) {
      // MAG firmware plays a season item with series=<episode number>; episode items carry it in the command.
      const [, sid, season, episode] = episodeCmd ?? [...(seasonCmd ?? []), params.get('series') ?? '1'];
      const ep = ids.byId.get(String(sid))?.episodes.find(e => e.season === Number(season) && e.episode === Number(episode));
      if (!ep) return { error: 'Channel or movie not found' };
      return { id: String(ep.id), cmd: `ffmpeg ${link('series', ep.id, ep)}` };
    }
    const match = type === 'itv' ? /^ffmpeg http:\/\/localhost\/ch\/(\d+)$/.exec(cmd) : /^\/(?:media|series)\/(\d+)\.mp4$/.exec(cmd);
    const id = Number(match?.[1]);
    // MAG firmware plays episodes through type=vod, so the command prefix (not type) decides.
    const isEpisode = type !== 'itv' && cmd.startsWith('/series/');
    const item = type === 'itv' ? catalog.live[id - 1] : isEpisode ? catalog.episodes.find(e => e.id === id) : catalog.movies[id - 1];
    if (!match || !item || !Number.isSafeInteger(id) || id < 1) return { error: 'Channel or movie not found' };
    return { id: String(id), cmd: `ffmpeg ${link(type === 'itv' ? 'live' : isEpisode ? 'series' : 'movie', id, item)}` };
  }
  if (type === 'itv') {
    const all = catalog.live.map((c, i) => ({ id: String(i + 1), name: c.name, number: String(i + 1), logo: c.logo ?? '', tv_genre_id: String(groups.indexOf(c.group_title ?? 'Uncategorized') + 1), cmd: `ffmpeg http://localhost/ch/${i + 1}`, use_http_tmp_link: '1', use_load_balancing: '0', censored: '0', status: 1 }));
    if (action === 'get_all_channels') return { total_items: all.length, max_page_items: all.length, data: all };
    return portalPage(all.filter(x => !category || category === '*' || category === '0' || x.tv_genre_id === category), page);
  }
  if (type === 'vod') return portalPage(catalog.movies.map((m, i) => {
    const metadata = providerMetadata(m);
    return { id: String(i + 1), name: cleanName(m.name), screenshot_uri: m.logo ?? '', description: metadata.plot ?? '', year: metadata.releaseDate.slice(0, 4), rating_imdb: metadata.rating ?? '', category_id: String(groups.indexOf(m.group_title ?? 'Uncategorized') + 1), cmd: `/media/${i + 1}.mp4` };
  }).filter(x => !category || category === '*' || category === '0' || x.category_id === category), page);
  if (type === 'series') {
    // Firmwares send movie_id=0 / season_id=0 on the plain list screen, and some send movie_id=<series>:<season>.
    const present = (v: string | null) => (v && v !== '0' && v !== '*' ? v : null);
    const rawMovie = present(params.get('movie_id')), rawSeason = present(params.get('season_id'));
    const seasonId = rawSeason ?? (rawMovie?.includes(':') ? rawMovie : null);
    const seriesKey = rawMovie && !rawMovie.includes(':') ? rawMovie : seasonId?.split(':')[0] ?? null;
    if (seriesKey) {
      const selected = ids.byId.get(seriesKey);
      if (!selected) return { error: 'Series not found' };
      const sid = ids.idOf.get(selected) ?? 0;
      if (seasonId) {
        const season = Number(seasonId.split(':')[1]);
        if (!Number.isSafeInteger(season) || !selected.episodes.some(e => e.season === season)) return { error: 'Season not found' };
        return portalPage(selected.episodes.filter(e => e.season === season).map(e => ({ id: String(e.id), name: cleanName(e.name), episode: e.episode, series: String(e.episode), screenshot_uri: e.logo ?? selected.cover ?? '', cmd: `/series/${sid}:${e.season}:${e.episode}.mp4` })), page);
      }
      return portalPage([...new Set(selected.episodes.map(e => e.season))].map(n => ({ id: `${sid}:${n}`, movie_id: String(sid), name: `Season ${n}`, season_number: n, series: selected.episodes.filter(e => e.season === n).map(e => e.episode), is_season: '1', cmd: `/season/${sid}:${n}.mp4` })), page);
    }
    return portalPage(catalog.series.filter(s => allowed(s.category)).map(s => ({ id: String(ids.idOf.get(s)), name: cleanName(s.title), screenshot_uri: s.cover ?? '', category_id: String(groups.indexOf(s.category) + 1), is_series: '1', description: s.episodes[0] ? providerMetadata(s.episodes[0]).plot ?? '' : '' })), page);
  }
  return [];
}
const cleanName = (name: string) => name.replace(/\s*\{(?:tmdb|imdb)-[^}]*\}/gi, '').trim() || name;

/**
 * Portal series IDs derive from the series title, not list position, so adding or
 * reordering series in the GitHub playlist never makes a box's saved ID point elsewhere.
 */
export function stableSeriesIds(series: Catalog['series']) {
  const byId = new Map<string, Catalog['series'][number]>(), idOf = new Map<Catalog['series'][number], number>();
  for (const s of [...series].sort((a, b) => (a.title < b.title ? -1 : a.title > b.title ? 1 : 0))) {
    let h = 0x811c9dc5;
    for (const ch of s.title) { h ^= ch.codePointAt(0) ?? 0; h = Math.imul(h, 0x01000193) >>> 0; }
    let id = (h % 2_000_000_000) + 1;
    while (byId.has(String(id))) id = (id % 2_000_000_000) + 1;
    byId.set(String(id), s); idOf.set(s, id);
  }
  return { byId, idOf };
}
