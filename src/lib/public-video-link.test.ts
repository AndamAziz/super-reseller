import { afterEach, describe, expect, it, vi } from 'vitest';
import { handlePublicVideoLink, redirectFor } from './public-video-link.server';
import { publishedMoviePath } from './public-video-startup';
import { compactVideoName } from './video-names';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('short public video link', () => {
  it('redirects to the token-free public object URL', () => {
    const res = redirectFor('https://x.example', 'abc/v 1.mp4');
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('https://x.example/storage/v1/object/public/public-videos/abc/v%201.mp4');
    expect(res.headers.get('Location')).not.toMatch(/token=/);
  });
  it('rejects names that are not mp4', async () => {
    expect((await handlePublicVideoLink('evil.exe')).status).toBe(404);
  });
  it('starts the existing short movie link with zero lookup or cache I/O on a cold request', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://media.example');
    const fetch = vi.fn(() => { throw new Error('No lookup allowed'); });
    const match = vi.fn(() => { throw new Error('No cache lookup allowed'); });
    const put = vi.fn();
    vi.stubGlobal('fetch', fetch);
    vi.stubGlobal('caches', { default: { match, put } });
    const response = await handlePublicVideoLink('v-1d5b89a07c2d.mp4');
    expect(response.status).toBe(302);
    const target = new URL(response.headers.get('Location') ?? '');
    expect(target.pathname).toBe('/storage/v1/object/public/public-videos/2bce34f8-9310-4b4a-a6b4-b7a481fe0d05/utf8-d8acd988d985d988d986daaf2d3231.mp4');
    expect(target.search).toBe('');
    expect(fetch).not.toHaveBeenCalled();
    expect(match).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });
  it('keeps the legacy link and compact alias on the identical original video bytes', () => {
    const path = publishedMoviePath('v-1d5b89a07c2d.mp4');
    expect(path).toBe('2bce34f8-9310-4b4a-a6b4-b7a481fe0d05/utf8-d8acd988d985d988d986daaf2d3231.mp4');
    if (!path) throw new Error('Missing published movie');
    expect(compactVideoName(path)).toBe('v-1d5b89a07c2d.mp4');
    expect(publishedMoviePath('utf8-d8acd988d985d988d986daaf2d3231.mp4')).toBe(path);
    expect(publishedMoviePath('unknown.mp4')).toBeUndefined();
    expect(publishedMoviePath('__proto__')).toBeUndefined();
  });
  it('plays Collision Course from both the current link and the link saved in the GitHub playlist', () => {
    const path = '2bce34f8-9310-4b4a-a6b4-b7a481fe0d05/Movies--Collision-Course-2026.mp4';
    expect(compactVideoName(path)).toBe('v-0bfb9f91d8d3.mp4');
    expect(publishedMoviePath('v-0bfb9f91d8d3.mp4')).toBe(path);
    expect(publishedMoviePath('v-127d11c9b774.mp4')).toBe(path);
  });
});
