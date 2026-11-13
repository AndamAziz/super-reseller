import { expect, it } from 'vitest';
import { appendVodEntry, vodSourceSchema } from '../lib/vod-source';
import { parseM3U } from '../lib/m3u';
import { buildCatalog } from '../lib/playlist-auth.server';
import type { VodEntry } from '../lib/vod';
const movie: VodEntry = { id: 'fixture', title: 'Movie', media_type: 'movie', tmdb_id: 120, imdb_id: 'tt0120737', season: 1, episode: 1, created_at: '', overview: '', poster_path: null, release_date: '', source_url: 'https://media.example/movie.mp4' };
it('accepts direct MP4/M3U8 sources but not iframe pages or credentials', () => {
  expect(vodSourceSchema.parse(movie.source_url)).toBe(movie.source_url);
  expect(vodSourceSchema.parse('https://media.example/master.m3u8?token=x')).toBe('https://media.example/master.m3u8?token=x');
  expect(() => vodSourceSchema.parse('https://vaplayer.ru/embed/movie/120')).toThrow();
  expect(() => vodSourceSchema.parse('https://user:pass@media.example/video.mp4')).toThrow();
});
it('preserves existing Live TV bytes and adds an actual movie source with fallback', () => {
  const original = '#EXTM3U\r\n#EXTINF:-1 group-title="Live",Original\r\nhttps://media.example/live.m3u8\r\n';
  const updated = appendVodEntry(original, movie);
  expect(updated.startsWith(original)).toBe(true);
  expect(parseM3U(updated)[1]?.url).toBe(movie.source_url);
  expect(parseM3U(updated)[1]?.type).toBe('movie');
  expect(updated).toContain('fallback-url="https://vaplayer.ru/embed/movie/tt0120737?color=e50914"');
  expect(appendVodEntry(updated, movie)).toBe(updated);
});
it('publishes series with correctly parsed season and episode', () => {
  const text = appendVodEntry('#EXTM3U\n', { ...movie, media_type: 'tv', title: 'Lost', tmdb_id: 4607, season: 2, episode: 3 });
  const catalog = buildCatalog(parseM3U(text));
  expect(catalog.episodes[0]?.season).toBe(2);
  expect(catalog.episodes[0]?.episode).toBe(3);
  expect(catalog.episodes[0]?.url).toBe(movie.source_url);
});
it('refuses missing sources and conflicting saved entries without overwriting', () => {
  expect(() => appendVodEntry('#EXTM3U\n', { ...movie, source_url: null })).toThrow();
  const text = appendVodEntry('#EXTM3U\n', movie);
  expect(() => appendVodEntry(text, { ...movie, source_url: 'https://media.example/other.mp4' })).toThrow('already exists');
});