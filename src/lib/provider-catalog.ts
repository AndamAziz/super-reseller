import type { Series } from './playlist-auth.server';
import { channelIdentity, playbackUrl } from './media';
import { episodeCode } from './youtube';

export type ProviderSeries = { id: string; title: string; category: string; poster_url: string | null; tmdb_id?: number | null; provider_key?: string; source_identity?: string | null; description?: string };
export type ProviderEpisode = { id: string; series_id: string; season_id: string; season_number: number; episode_number: number; title: string; poster_url: string | null; language_label?: string; original_url: string; episode_code?: string; source_type?: string; playback: { source_type: 'youtube'; youtube_video_id: string; embed_url: string; original_url: string } | { source_type: 'm3u'; url: string; original_url: string } };
export type ProviderSeason = { id: string; series_id: string; season_number: number };
export const seriesTmdbId = (title: string) => {
  const value = /\{tmdb-(\d+)\}/i.exec(title)?.[1];
  return value ? Number(value) : null;
};

/** Pure additive catalogue merge: never edits legacy catalog IDs, URLs or records. */
export function mergeProviderCatalog(source: Series[], managed: { series: ProviderSeries[]; seasons: ProviderSeason[]; episodes: ProviderEpisode[] }, playback?: { origin: string; username: string; password: string }) {
  const series = managed.series.map(s => ({ ...s }));
  const episodes = managed.episodes.map(e => ({ ...e }));
  const aliases = new Map<string, string>();
  for (const item of source) {
    const tmdb = seriesTmdbId(item.title);
    const identity = JSON.stringify([item.title, item.category]);
    const matching = series.find(s => (s.provider_key ?? 'github') === 'github' && (tmdb ? s.tmdb_id === tmdb : s.source_identity === identity));
    const canonical = matching ?? series.find(s => s.id === (tmdb ? `m3u:github:tmdb:${tmdb}` : `m3u:github:${channelIdentity({ name: item.title, group_title: item.category })}`));
    const id = canonical?.id ?? (tmdb ? `m3u:github:tmdb:${tmdb}` : `m3u:github:${channelIdentity({ name: item.title, group_title: item.category })}`);
    if (!canonical) series.push({ id, title: item.title, category: item.category, poster_url: item.cover, tmdb_id: tmdb, provider_key: 'github', source_identity: identity });
    aliases.set(`m3u:github:${item.id}`, id);
    for (const e of item.episodes) episodes.push({
      id: `m3u:github:${channelIdentity(e)}:${e.id}`, series_id: id, season_id: `${id}:season:${e.season}`, season_number: e.season, episode_number: e.episode,
      title: e.name, poster_url: e.logo ?? canonical?.poster_url ?? item.cover, language_label: e.group_title ?? '', original_url: e.url, episode_code: episodeCode(e.season, e.episode), source_type: 'm3u',
      playback: { source_type: 'm3u', original_url: e.url, url: playback ? playbackUrl(playback.origin, 'series', playback.username, playback.password, e.id, e.url, e) : e.url },
    });
  }
  // Preserve alternatives at the same episode number instead of overwriting either source.
  episodes.sort((a, b) => a.season_number - b.season_number || a.episode_number - b.episode_number || a.id.localeCompare(b.id));
  const seasons: ProviderSeason[] = [];
  for (const e of episodes) {
    const saved = seasons.find(s => s.series_id === e.series_id && s.season_number === e.season_number);
    if (saved) { e.season_id = saved.id; continue; }
    const original = managed.seasons.find(s => s.series_id === e.series_id && s.season_number === e.season_number);
    const season = original ?? { id: `${e.series_id}:season:${e.season_number}`, series_id: e.series_id, season_number: e.season_number };
    seasons.push(season); e.season_id = season.id;
  }
  return { series: series.filter(s => episodes.some(e => e.series_id === s.id)), seasons: seasons.sort((a,b) => a.season_number-b.season_number), episodes };
}