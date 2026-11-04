import { describe, it, expect, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ row: null as unknown, saves: vi.fn(), update: vi.fn() }));
vi.mock('@/integrations/supabase/client.server', () => ({ supabaseAdmin: { from: (table: string) => {
  const chain = { select: () => chain, eq: () => chain, abortSignal: () => chain,
    maybeSingle: async () => ({ data: table === 'app_settings' ? { value: 'https://raw.githubusercontent.com/example/main/playlist.m3u' } : mocks.row, error: null }),
    update: (row: unknown) => { mocks.update(row); return chain; },
    upsert: (row: unknown) => { mocks.saves(row); return chain; },
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve),
  }; return chain;
} } }));
describe('durable provider catalog', () => {
  it('loads cold customer reads without touching GitHub', async () => {
    vi.resetModules();
    mocks.row = { catalog: { channels: [{ name: 'Saved' }] }, checked_at: new Date().toISOString() };
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    const { readStoredCatalog } = await import('@/lib/provider-catalog-store.server');
    expect((await readStoredCatalog()).channels[0]?.name).toBe('Saved');
    expect(fetcher).not.toHaveBeenCalled(); vi.unstubAllGlobals();
  });
  it('sends the stored ETag and does not parse a 304', async () => {
    vi.resetModules();
    mocks.row = { catalog: { channels: [{ name: 'Saved' }] }, source_url: 'https://raw.githubusercontent.com/example/main/playlist.m3u', etag: '"original"', checked_at: '2020-01-01' };
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 304 })); vi.stubGlobal('fetch', fetcher);
    const { refreshStoredCatalog } = await import('@/lib/provider-catalog-store.server');
    const parse = vi.fn(); await refreshStoredCatalog(parse);
    expect(fetcher.mock.calls[0]?.[1].headers.get('If-None-Match')).toBe('"original"');
    expect(parse).not.toHaveBeenCalled(); vi.unstubAllGlobals();
  });
  it('retains the stored catalog when GitHub fails', async () => {
    vi.resetModules();
    const fetcher = vi.fn().mockRejectedValue(new Error('outage')); vi.stubGlobal('fetch', fetcher);
    const { refreshStoredCatalog } = await import('@/lib/provider-catalog-store.server');
    expect((await refreshStoredCatalog(vi.fn())).channels[0]?.name).toBe('Saved');
    expect(fetcher).toHaveBeenCalledTimes(2); vi.unstubAllGlobals();
  });
});