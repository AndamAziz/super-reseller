import { describe, expect, it, vi } from 'vitest';
import { accountLabels, generateMac, macSchema, portalPage, requestMac, PORTAL_URL } from '../lib/mac-portal';
import { portalCatalogResponse, type PortalAccount } from '../lib/mac-portal-catalog';
import { buildCatalog } from '../lib/playlist-auth.server';
import { parseM3U } from '../lib/m3u';
import { playbackUrl } from '../lib/media';

vi.mock('../lib/provider-catalog-store.server', () => ({ readStoredCatalog: vi.fn(), refreshStoredCatalog: vi.fn() }));
const account: PortalAccount = { lineId: '11111111-1111-4111-8111-111111111111', id: 1, username: 'fixture', password: 'test-password', expiresAt: '2030-01-01T00:00:00Z', mac: '00:1A:79:00:00:01', maxConnections: 1 };
const catalog = buildCatalog(parseM3U('#EXTM3U\n#EXTINF:-1 group-title="Z",Live Z\nhttps://media.example/live.ts\n#EXTINF:-1 group-title="A",Live A\nhttps://media.example/live.m3u8\n#EXTINF:-1 tvg-type="movie" group-title="Films",Film\nhttps://media.example/film.mp4\n#EXTINF:-1 tvg-type="series" group-title="Shows",Show - S01E02\nhttps://media.example/episode.mp4'));
const action = (query: string) => portalCatalogResponse(catalog, new URLSearchParams(query), account, 'https://re.andam.uk');
describe('MAC portal rules', () => {
  it('normalizes the required vendor prefix and rejects other MAC formats', () => {
    expect(macSchema.parse(' 00:1a:79:ab:cd:ef ')).toBe('00:1A:79:AB:CD:EF');
    expect(macSchema.safeParse('11:1A:79:AB:CD:EF').success).toBe(false);
    expect(macSchema.safeParse('00:1A:79:AB:CD').success).toBe(false);
    expect(macSchema.safeParse(generateMac()).success).toBe(true);
  });
  it('accepts URL-encoded MAC cookies and query MACs', () => {
    expect(requestMac(new Request('https://example.test/', { headers: { cookie: 'mac=00%3A1a%3A79%3A00%3A00%3A01' } }))).toBe(account.mac);
    expect(requestMac(new Request('https://example.test/?mac=00:1A:79:00:00:01'))).toBe(account.mac);
  });
  it('paginates exactly 14 without renumbering original IDs', () => {
    const result = portalPage(Array.from({ length: 30 }, (_, i) => i + 1), 2);
    expect(result.data).toEqual(Array.from({ length: 14 }, (_, i) => i + 15));
    expect(result.total_items).toBe(30);
    expect(result.max_page_items).toBe(14);
  });
  it('preserves provider category order', () => {
    expect(action('type=itv&action=get_genres')).toEqual([{ id: '1', title: 'Z', alias: 'Z' }, { id: '2', title: 'A', alias: 'A' }]);
  });
  it('uses unchanged authenticated playback URL and original stream ID after filtering', () => {
    const list = action('type=itv&action=get_ordered_list&genre=2&p=1') as { data: { id: string; cmd: string }[] };
    expect(list.data[0]?.id).toBe('2');
    const params = new URLSearchParams({ type: 'itv', action: 'create_link', cmd: list.data[0]?.cmd ?? '' });
    const c = catalog.live[1];
    if (!c) throw new Error('Missing fixture');
    expect(portalCatalogResponse(catalog, params, account, 'https://re.andam.uk')).toEqual({ id: '2', cmd: `ffmpeg ${playbackUrl('https://re.andam.uk', 'live', account.username, account.password, 2, c.url, c)}` });
  });
  it('rejects arbitrary URL commands instead of signing or echoing them', () => {
    expect(action('type=itv&action=create_link&cmd=ffmpeg%20https://evil.test/')).toEqual({ error: 'Channel or movie not found' });
  });
  it('provides movies, seasons and episodes with the same existing IDs', () => {
    expect(action('type=vod&action=get_ordered_list')).toMatchObject({ data: [{ id: '1', cmd: '/media/1.mp4' }] });
    expect(action('type=series&action=get_ordered_list&movie_id=1')).toMatchObject({ data: [{ id: '1:1', season_number: 1 }] });
    expect(action('type=series&action=get_ordered_list&movie_id=1&season_id=1:1')).toMatchObject({ data: [{ id: '1', cmd: '/series/1.mp4', episode: 2 }] });
  });
});