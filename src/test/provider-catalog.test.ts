import { describe, expect, it } from 'vitest';
import { mergeProviderCatalog } from '@/lib/provider-catalog';
import { playbackUrl } from '@/lib/media';
import type { Series } from '@/lib/playlist-auth.server';

const m3u: Series = { id: 5, title: 'Setayesh _ ستایش {tmdb-94146}', category: 'KURDISH-دۆبلاژ', cover: 'https://images.example/setayesh.jpg', episodes: [17, 2, 1].map(n => ({ id: n, season: 1, episode: n, name: `Setayesh _ ستایش {tmdb-94146} - S01E${String(n).padStart(2,'0')}`, group_title: 'KURDISH-دۆبلاژ', logo: 'https://images.example/setayesh.jpg', referrer: null, url: `https://streams.example/${n}.m3u8`, type: 'series' })) };
const managed = { series: [{ id: 'saved', title: 'Setayesh', category: 'KURDISH-دۆبلاژ', poster_url: null, tmdb_id: 94146, provider_key: 'github' }], seasons: [{ id: 'season', series_id: 'saved', season_number: 1 }], episodes: [{ id: 'yt', series_id: 'saved', season_id: 'season', season_number: 1, episode_number: 17, title: 'Setayesh - S01E17', poster_url: 'https://images.example/yt.jpg', language_label: 'KURDISH-دۆبلاژ', original_url: 'https://www.youtube.com/watch?v=3leqKX7BsFw', playback: { source_type: 'youtube' as const, youtube_video_id: '3leqKX7BsFw', embed_url: 'https://www.youtube.com/embed/3leqKX7BsFw', original_url: 'https://www.youtube.com/watch?v=3leqKX7BsFw' } }] };
describe('provider-level series merging', () => {
  it('retains earlier explicit GitHub source identity links without TMDB columns', () => {
    const result = mergeProviderCatalog([m3u], { ...managed, series: [{ ...managed.series[0], id: 'saved', title: 'Setayesh', category: '', poster_url: null, tmdb_id: null, source_identity: JSON.stringify([m3u.title,m3u.category]) }] });
    expect(result.series.map(s => s.id)).toEqual(['saved']);
  });
  it('merges TMDB 94146 into exactly one existing logical series', () => {
    const result = mergeProviderCatalog([m3u], managed);
    expect(result.series.map(s => s.id)).toEqual(['saved']);
    expect(result.episodes.every(e => e.series_id === 'saved')).toBe(true);
    expect(result.episodes.map(e => e.episode_number)).toEqual([1,2,17,17]);
    expect(result.seasons).toEqual([{ id: 'season', series_id: 'saved', season_number: 1 }]);
  });
  it('preserves every M3U episode and its legacy generated URL while keeping the YouTube alternative', () => {
    const auth = { origin: 'https://panel.example', username: 'test', password: 'test-only' };
    const before = JSON.stringify(m3u);
    const result = mergeProviderCatalog([m3u], managed, auth);
    const episode = result.episodes.find(e => e.playback.source_type === 'm3u' && e.episode_number === 17);
    expect(episode?.playback).toEqual({ source_type: 'm3u', original_url: 'https://streams.example/17.m3u8', url: playbackUrl(auth.origin,'series',auth.username,auth.password,17,'https://streams.example/17.m3u8',m3u.episodes[0]) });
    expect(result.episodes.find(e => e.id === 'yt')?.playback).toEqual(managed.episodes[0]?.playback);
    expect(JSON.stringify(m3u)).toBe(before);
  });
  it('never merges matching TMDB identities across providers', () => {
    const result = mergeProviderCatalog([m3u], { ...managed, series: [{ ...managed.series[0], id: 'private', title: 'Private', category: '', poster_url: null, provider_key: 'other' }] });
    expect(result.series.map(s => s.id)).toContain('m3u:github:tmdb:94146');
    expect(result.episodes.filter(e => e.playback.source_type==='m3u').every(e => e.series_id !== 'private')).toBe(true);
  });
});