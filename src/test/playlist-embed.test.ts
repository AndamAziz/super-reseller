import { expect, it } from 'vitest';
import { buildM3U, parseM3U } from '@/lib/m3u';
import { playlistEmbed } from '@/lib/playlist-embed';

function entry(type: string, attrs: string, name = 'Film', url = 'https://media.example/file.mp4') {
  const channel = parseM3U(`#EXTM3U\n#EXTINF:-1 tvg-type="${type}" ${attrs},${name}\n${url}`)[0];
  if (!channel) throw new Error('Missing fixture');
  return channel;
}
it('prefers IMDb over TMDB and provider IDs for the exact movie format', () => {
  expect(playlistEmbed(entry('movie', 'imdb-id="tt0120737" tmdb-id="120" provider-id="42"')).url).toBe('https://vaplayer.ru/embed/movie/tt0120737?color=e50914');
});
it('falls back to title TMDB then source-declared provider identity', () => {
  expect(playlistEmbed(entry('movie', '', 'Film {tmdb-120}')).url).toBe('https://vaplayer.ru/embed/movie/120?color=e50914');
  expect(playlistEmbed(entry('movie', 'provider-id="42"')).url).toBe('https://vaplayer.ru/embed/movie/42?color=e50914');
});
it('parses series S02E03 and emits exact TV format', () => {
  expect(playlistEmbed(entry('series', 'imdb="tt0944947"', 'Show - S02E03')).url).toBe('https://vaplayer.ru/embed/tv/tt0944947/2/3?color=e50914');
});
it('accepts declared season/episode and 2x03 codes', () => {
  expect(playlistEmbed(entry('series', 'tmdb="1399" season="2" episode="3"')).url).toBe('https://vaplayer.ru/embed/tv/1399/2/3?color=e50914');
  expect(playlistEmbed(entry('series', 'tmdb="1399"', 'Show 2x03')).url).toBe('https://vaplayer.ru/embed/tv/1399/2/3?color=e50914');
});
it('uses explicit source movie/TV paths without passing query credentials', () => {
  expect(playlistEmbed(entry('series', '', 'Show', 'https://media.example/embed/tv/1399/2/3?token=private')).url).toBe('https://vaplayer.ru/embed/tv/1399/2/3?color=e50914');
});
it('does not invent missing identity or episode numbers or accept URL-like IDs', () => {
  expect(playlistEmbed(entry('movie', 'provider-id="https://other.example"')).url).toBeNull();
  expect(playlistEmbed(entry('series', 'tmdb="1399"')).url).toBeNull();
});
it('leaves Live TV and original exports untouched', () => {
  const live = entry('live', 'imdb="tt0120737"');
  const movie = entry('movie', 'tmdb="120"');
  const original = buildM3U([live, movie]);
  expect(playlistEmbed(live).url).toBeNull();
  playlistEmbed(movie);
  expect(buildM3U([live, movie])).toBe(original);
  expect(live.url).toBe('https://media.example/file.mp4');
});