import { describe, it, expect, vi } from 'vitest';
import { vodEmbed } from '../lib/vod';
import { tmdbRequest } from '../lib/tmdb.server';
describe('VidAPI mapping', () => {
  it('uses the documented IMDb movie endpoint', () => { expect(vodEmbed({ media_type: 'movie', tmdb_id: 120, imdb_id: 'tt0120737', season: 1, episode: 1 })).toBe('https://vaplayer.ru/embed/movie/tt0120737?color=e50914'); });
  it('falls back to TMDB and preserves episode selection', () => { expect(vodEmbed({ media_type: 'tv', tmdb_id: 1399, imdb_id: null, season: 2, episode: 3 })).toBe('https://vaplayer.ru/embed/tv/1399/2/3?color=e50914'); });
  it('rejects invalid episode numbers', () => { expect(() => vodEmbed({ media_type: 'tv', tmdb_id: 1399, imdb_id: null, season: 0, episode: 3 })).toThrow('Invalid episode'); });
  it('keeps saved API credentials out of metadata responses', async () => {
    vi.stubEnv('TMDB_API_KEY', 'test-only-key');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 120, title: 'Movie' })));
    vi.stubGlobal('fetch', fetchMock);
    try { expect(await tmdbRequest('movie/120')).toEqual({ id: 120, title: 'Movie' }); const call = fetchMock.mock.calls[0]; if (!call) throw new Error('Expected TMDB request'); expect(new URL(call[0]).searchParams.get('api_key')).toBe('test-only-key'); }
    finally { vi.unstubAllEnvs(); vi.unstubAllGlobals(); }
  });
});