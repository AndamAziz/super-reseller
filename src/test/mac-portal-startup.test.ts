import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildCatalog } from '../lib/playlist-auth.server';
import { parseM3U } from '../lib/m3u';
import { handleMacPortal } from '../lib/mac-portal.server';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), loadCatalog: vi.fn() }));
vi.mock('@/integrations/supabase/client.server', () => ({ supabaseAdmin: { rpc: mocks.rpc } }));
vi.mock('../lib/provider-catalog-store.server', () => ({ readStoredCatalog: vi.fn(), refreshStoredCatalog: vi.fn() }));
vi.mock('../lib/playlist-auth.server', async (original) => ({ ...await original<object>(), loadCatalog: mocks.loadCatalog }));

const account = { lineId: '11111111-1111-4111-8111-111111111111', id: 1, username: 'fixture', password: 'fixture-password', mac: '00:1A:79:00:00:01', expiresAt: '2030-01-01T00:00:00Z', maxConnections: 1 };
const request = (query: string, authenticated = true) => new Request('https://re.andam.uk/api/public/c/server/load.php?' + query, { headers: { cookie: 'mac=00%3A1A%3A79%3A00%3A00%3A01', ...(authenticated ? { Authorization: 'Bearer ' + 'a'.repeat(32) } : {}) } });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.rpc.mockReturnValue({ abortSignal: async () => ({ data: account, error: null }) });
  mocks.loadCatalog.mockResolvedValue({ ok: true, catalog: buildCatalog(parseM3U('#EXTM3U\n#EXTINF:-1,One\nhttps://example.test/one.ts')) });
});
describe('MAG startup protocol', () => {
  it('advertises only TV, movies and series without loading the catalog', async () => {
    expect(await (await handleMacPortal(request('type=stb&action=get_modules'))).json()).toEqual({ js: { all_modules: ['tv', 'videoclub', 'series'], disabled_modules: [], restricted_modules: [] } });
    expect(mocks.loadCatalog).not.toHaveBeenCalled();
  });
  it('returns a localization dictionary for authenticated startup', async () => {
    expect(await (await handleMacPortal(request('type=stb&action=get_localization'))).json()).toMatchObject({ js: { TV: 'TV', VIDEOCLUB: 'Movies', SERIES: 'Series' } });
    expect(mocks.loadCatalog).not.toHaveBeenCalled();
  });
  it('does not expose startup account responses without a token', async () => {
    expect(await (await handleMacPortal(request('type=stb&action=get_modules', false))).json()).toEqual({ js: { error: 'Invalid or expired token' } });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('accepts p=0 through request validation and returns the first saved channel', async () => {
    expect(await (await handleMacPortal(request('type=itv&action=get_ordered_list&p=0'))).json()).toMatchObject({ js: { cur_page: 1, data: [{ id: '1', name: 'One' }] } });
    expect(await (await handleMacPortal(request('type=itv&action=get_ordered_list&p=-1'))).json()).toEqual({ js: { error: 'Invalid request' } });
  });
  it('completes authenticated do_auth without inventing a second password flow', async () => {
    expect(await (await handleMacPortal(request('type=stb&action=do_auth'))).json()).toEqual({ js: true });
  });
});