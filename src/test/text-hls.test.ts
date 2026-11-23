import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => vi.fn());
const catalog = vi.hoisted(() => vi.fn());
const limit = vi.hoisted(() => vi.fn());
vi.mock('@/lib/playlist-auth.server', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/playlist-auth.server')>(),
  authLine: auth, loadCatalog: catalog,
}));
vi.mock('@/lib/stream-proxy.server', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/stream-proxy.server')>(),
  checkStreamLimit: limit,
}));

import { buildCatalog } from '@/lib/playlist-auth.server';
import { parseM3U } from '@/lib/m3u';
import { handleMediaPlayback } from '@/lib/media-playback.server';
import { handleXtreamRequest } from '@/routes/player_api[.]php';
import { proxyFetch, rewritePlaylist, unb64u } from '@/lib/stream-proxy.server';

const source = 'https://hlszone.com/cdn/hls/002e7b726779909de2f92a6b5b5087f8/master.txt?token=a%2Fb&x=1';
const master = '#EXTM3U\n#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",URI="/m3/audio"\n#EXT-X-STREAM-INF:BANDWIDTH=1792000,AUDIO="audio"\n/m3/video\n';
const channel = { name: 'Fixture', group_title: null, logo: null, referrer: 'https://hlszone.com/', url: source };
beforeEach(() => {
  auth.mockResolvedValue({ ok: true, username: 'text-fixture', password: 'fixture', lineId: 'fixture', maxConnections: 5 });
  limit.mockReset().mockResolvedValue(null);
  catalog.mockResolvedValue({ ok: true, catalog: buildCatalog(parseM3U(`#EXTM3U\n#EXTINF:-1 tvg-type="live",Live\n${source}\n#EXTINF:-1 tvg-type="movie",Movie\n${source}\n#EXTINF:-1 tvg-type="series",Series S01E01\n${source}`)) });
  vi.stubGlobal('fetch', vi.fn(async () => new Response(master, { headers: { 'Content-Type': 'text/plain' } })));
});
afterEach(() => vi.unstubAllGlobals());

describe('text-named HLS', () => {
  it.each(['live', 'movie', 'series'] as const)('%s entry redirects to exact original .txt URL with query after admission', async kind => {
    const res = await handleMediaPlayback(new Request(`https://app.test/api/public/${kind}/text-fixture/fixture/1.mp4`), 'text-fixture', 'fixture', '1.mp4', kind);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(source);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(limit).toHaveBeenCalledTimes(1);
    expect(await res.text()).toBe('');
  });
  it('does not hand off playback when the line limit is full', async () => {
    limit.mockResolvedValue(new Response('Max connections reached for this line', { status: 429 }));
    expect((await handleMediaPlayback(new Request('https://app.test/live/text-fixture/fixture/1.m3u8'), 'text-fixture', 'fixture', '1.m3u8', 'live')).status).toBe(429);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('does not hand off playback with invalid credentials', async () => {
    auth.mockResolvedValue({ ok: false, status: 401, message: 'Invalid credentials' });
    expect((await handleMediaPlayback(new Request('https://app.test/live/bad/bad/1.m3u8'), 'bad', 'bad', '1.m3u8', 'live')).status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('omits Origin on the master and any signed segment from this source while retaining Referer', async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _options?: RequestInit) => new Response(master, { headers: { 'Content-Type': 'text/plain' } }));
    vi.stubGlobal('fetch', fetcher);
    await proxyFetch(new Request('https://app.test', { headers: { Origin: 'http://tv.andam.uk' } }), new URL(source), channel, 'https://app.test/proxy/1', 'u:1');
    await proxyFetch(new Request('https://app.test'), new URL('https://segment.test/chunk.js'), channel, 'https://app.test/proxy/1', 'u:1');
    for (const call of fetcher.mock.calls) {
      const headers = new Headers(call[1]?.headers);
      expect(headers.has('Origin')).toBe(false);
      expect(headers.get('Referer')).toBe('https://hlszone.com/');
    }
  });
  it('preserves mp4 bytes behind .txt instead of redirecting based on the filename alone', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109]), { headers: { 'Content-Type': 'video/mp4' } })));
    expect((await proxyFetch(new Request('https://app.test'), new URL(source), channel, 'https://app.test/proxy/1', 'u:1')).status).toBe(200);
  });
  it('advertises m3u8 in movie and episode details, never mp4 or ts', async () => {
    const get = async (action: string, args: string) => (await handleXtreamRequest(new Request(`https://app.test/player_api.php?username=text-fixture&password=fixture&action=${action}${args}`))).json();
    const movie = await get('get_vod_info', '&vod_id=1');
    const series = await get('get_series_info', '&series_id=1');
    expect(movie.movie_data.container_extension).toBe('m3u8');
    expect(movie.movie_data.direct_source).toContain('/1.m3u8?');
    expect(series.episodes['1'][0].container_extension).toBe('m3u8');
  });
  it('resolves root-relative audio and video URIs against the original host when rewriting is used', async () => {
    const out = await rewritePlaylist(master, source, 'https://app.test/proxy/1', 'u:1');
    const audio = /URI="([^"]+)"/.exec(out)?.[1];
    const video = out.split('\n').find(line => line.startsWith('https://'));
    if (!audio || !video) throw new Error('Missing rewritten variants');
    expect(unb64u(new URL(audio).searchParams.get('u') ?? '')).toBe('https://hlszone.com/m3/audio');
    expect(unb64u(new URL(video).searchParams.get('u') ?? '')).toBe('https://hlszone.com/m3/video');
  });
});