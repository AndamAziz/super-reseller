import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ auth: vi.fn(), catalog: vi.fn(), rows: {} as Record<string, unknown[]>, filters: [] as [string, string, unknown][] }));
vi.mock('@/lib/playlist-auth.server', () => ({ authLine: mocks.auth, loadCatalog: mocks.catalog, json: (value: unknown, status = 200) => new Response(JSON.stringify(value), { status }) }));
vi.mock('@/lib/content-posters.server', () => ({ displayPoster: async (_client: unknown, url: string | null) => url }));
vi.mock('@/integrations/supabase/client.server', () => ({ supabaseAdmin: { from: (table: string) => {
  const filters: [string, unknown][] = [];
  const chain = {
    select: () => chain,
    eq: (key: string, value: unknown) => { filters.push([key, value]); mocks.filters.push([table, key, value]); return chain; },
    order: () => chain,
    range: () => chain,
    single: async () => ({ data: { reseller_id: 'owner-a' }, error: null }),
    then: (resolve: (value: unknown) => unknown) => resolve({ data: (mocks.rows[table] ?? []).filter(row => filters.every(([key, value]) => (row as Record<string, unknown>)[key] === value)), error: null }),
  };
  return chain;
} } }));
import { handleContentApi } from '@/lib/content-api.server';

const sid = '00000000-0000-4000-8000-000000000001';
const eid = '00000000-0000-4000-8000-000000000021';
const fixture = { id: eid, owner_id: 'owner-a', series_id: sid, season_id: 'season', season_number: 1, episode_number: 21, title: 'Episode 21', youtube_video_id: 'M7lc1UVf-VE', original_url: 'https://youtu.be/M7lc1UVf-VE', poster_url: null, published: true };
const request = (query = '') => new Request(`https://panel.example/api/public/content${query}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'customer', password: 'test-only' }) });
beforeEach(() => {
  mocks.filters = [];
  mocks.catalog.mockResolvedValue({ ok: true, catalog: { series: [], version: 'test' } });
  mocks.auth.mockResolvedValue({ ok: true, lineId: 'line' });
  mocks.rows = { content_series: [{ id: sid, owner_id: 'owner-a', title: 'Jumong', poster_url: 'https://images.example/series.jpg' }], content_seasons: [{ id: 'season', owner_id: 'owner-a', series_id: sid, season_number: 1 }], content_episodes: [fixture, { ...fixture, id: 'draft', episode_number: 22, published: false }, { ...fixture, id: 'other', owner_id: 'owner-b' }] };
});
describe('customer content API', () => {
  it('delivers provider TMDB metadata and language with unchanged poster and official source', async () => {
    mocks.rows['content_series'] = [{ id: sid, owner_id: 'owner-a', title: 'Setayesh', tmdb_id: 94146, provider_key: 'github' }];
    mocks.rows['content_episodes'] = [{ ...fixture, episode_number: 17, language_label: 'KURDISH-دۆبلاژ', original_url: 'https://www.youtube.com/watch?v=3leqKX7BsFw', youtube_video_id: '3leqKX7BsFw', poster_url: 'https://media.themoviedb.org/t/p/w600_and_h900_face/6e7Wkc5jckzksjKta4TELHCufs.jpg' }];
    const data = await (await handleContentApi(request('?provider_key=github&language=KURDISH-%D8%AF%DB%86%D8%A8%D9%84%D8%A7%DA%98'))).json();
    expect(data.series[0].tmdb_id).toBe(94146);
    expect(data.episodes[0].episode_code).toBe('S01E17');
    expect(data.episodes[0].language_label).toBe('KURDISH-دۆبلاژ');
    expect(data.episodes[0].poster_url).toBe('https://media.themoviedb.org/t/p/w600_and_h900_face/6e7Wkc5jckzksjKta4TELHCufs.jpg');
    expect(data.episodes[0].playback.source_type).toBe('youtube');
    const filtered = await (await handleContentApi(request('?provider_key=other'))).json();
    expect(filtered.episodes).toEqual([]);
  });
  it('authenticates every request', async () => {
    mocks.auth.mockResolvedValue({ ok: false, status: 401, message: 'Invalid credentials' });
    expect((await handleContentApi(request())).status).toBe(401);
  });
  it('scopes published content to the line owner and excludes drafts', async () => {
    const data = await (await handleContentApi(request())).json();
    expect(data.episodes.map((e: { id: string }) => e.id)).toEqual([eid]);
    expect(mocks.filters).toContainEqual(['content_episodes', 'owner_id', 'owner-a']);
    expect(mocks.filters).toContainEqual(['content_episodes', 'published', true]);
  });
  it('generates S01E21 with explicit official YouTube source and series-poster fallback', async () => {
    const data = await (await handleContentApi(request())).json();
    expect(data.episodes[0].episode_code).toBe('S01E21');
    expect(data.episodes[0].poster_url).toBe('https://images.example/series.jpg');
    expect(data.episodes[0].playback).toEqual({ source_type: 'youtube', youtube_video_id: 'M7lc1UVf-VE', embed_url: 'https://www.youtube.com/embed/M7lc1UVf-VE', original_url: 'https://youtu.be/M7lc1UVf-VE' });
    expect(data.refresh_after_seconds).toBe(5);
  });
  it('denies foreign or unpublished episode details', async () => {
    expect((await handleContentApi(request('?action=episode&episode_id=00000000-0000-4000-8000-000000000099'))).status).toBe(404);
  });
  it('changes revisions when an episode is added without changing S01E21', async () => {
    const first = await (await handleContentApi(request())).json();
    mocks.rows['content_episodes']?.push({ ...fixture, id: 'new', episode_number: 22 });
    const next = await (await handleContentApi(request())).json();
    expect(next.revision).not.toBe(first.revision);
    expect(next.episodes.map((e: { episode_code: string }) => e.episode_code)).toEqual(['S01E21', 'S01E22']);
  });
});