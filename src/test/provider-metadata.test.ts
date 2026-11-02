import { describe, expect, it, vi } from 'vitest';
import { parseM3U } from '@/lib/m3u';
import { providerMetadata } from '@/lib/provider-metadata';

const auth = vi.hoisted(() => vi.fn());
const catalog = vi.hoisted(() => vi.fn());
vi.mock('@/lib/playlist-auth.server', async importOriginal => {
  const original = await importOriginal<typeof import('@/lib/playlist-auth.server')>();
  return { ...original, authLine: auth, loadCatalog: catalog };
});
import { buildCatalog } from '@/lib/playlist-auth.server';
import { handleXtreamRequest } from '@/routes/player_api[.]php';

const text = `#EXTM3U
#EXTINF:-1 tvg-type="movie"tvg-logo="https://poster.example/a,1.jpg"group-title="KURDISH"audio-language="ku"subtitle-language="en"plot="Original plot",The Fellowship {tmdb-120}
https://media.example/movie.mp4
#EXTINF:-1 tvg-type="series"tvg-logo="https://poster.example/joseph.jpg"group-title="KURDISH",Prophet Joseph {tmdb-70802} - S01E01
https://media.example/episode.m3u8`;

describe('provider source metadata', () => {
  it('retains source TMDB, comma-containing poster and declared audio/subtitle languages', () => {
    const m = parseM3U(text)[0];
    if (!m) throw new Error('Missing movie');
    expect(m.logo).toBe('https://poster.example/a,1.jpg');
    expect(providerMetadata(m)).toMatchObject({ tmdb_id: 120, plot: 'Original plot', language: 'ku', subtitle_language: 'en' });
  });
  it('never invents unavailable audio, subtitle or TMDB metadata', () => {
    const m = parseM3U('#EXTM3U\n#EXTINF:-1 tvg-type="movie",Untitled\nhttps://media.example/a.mp4')[0];
    if (!m) throw new Error('Missing movie');
    expect(providerMetadata(m)).toMatchObject({ language: '', subtitle_language: '' });
    expect(providerMetadata(m)).not.toHaveProperty('tmdb_id');
  });
  it('delivers full movie details and series TMDB without bypassing authenticated playback', async () => {
    auth.mockResolvedValue({ ok: true, username: 'fixture', password: 'fixture', lineId: 'fixture' });
    catalog.mockResolvedValue({ ok: true, catalog: buildCatalog(parseM3U(text)) });
    const get = async (action: string, args = '') => (await handleXtreamRequest(new Request(`https://panel.example/player_api.php?username=fixture&password=fixture&action=${action}${args}`))).json();
    const movies = await get('get_vod_streams');
    const movie = await get('get_vod_info', '&vod_id=1');
    expect(movies[0].tmdb_id).toBe(120);
    expect(movie.info).toMatchObject({ tmdb_id: 120, name: 'The Fellowship {tmdb-120}', movie_image: 'https://poster.example/a,1.jpg', language: 'ku', subtitle_language: 'en' });
    expect(movie.movie_data.direct_source).toBe(movies[0].direct_source);
    expect(movie.movie_data.direct_source).toContain('/api/public/movie/fixture/fixture/1.mp4?channel=');
    expect((await get('get_series'))[0].tmdb_id).toBe(70802);
    const series = await get('get_series_info', '&series_id=1');
    expect(series.info.tmdb_id).toBe(70802);
    expect(series.episodes['1'][0].info.tmdb_id).toBe(70802);
    expect(series.episodes['1'][0].episode_num).toBe(1);
    expect((await get('get_vod_info', '&vod_id=-1')).movie_data).toEqual({});
  });
  it('blocks invalid customer credentials before any catalog read', async () => {
    auth.mockResolvedValue({ ok: false, status: 401, message: 'Invalid credentials' });
    catalog.mockClear();
    const res = await handleXtreamRequest(new Request('https://panel.example/player_api.php?action=get_vod_info&vod_id=1'));
    expect((await res.json()).user_info.auth).toBe(0);
    expect(catalog).not.toHaveBeenCalled();
  });
});