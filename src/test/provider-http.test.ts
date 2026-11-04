import { describe, it, expect } from 'vitest';
import { privateListValidator, PROVIDER_DEADLINE_MS, providerActions } from '@/lib/provider-http';
import { CATALOG_REFRESH_MS } from '@/lib/provider-catalog-store.server';
describe('provider reliability contract', () => {
  it('uses a five-minute catalog refresh interval', () => expect(CATALOG_REFRESH_MS).toBe(5 * 60 * 1000));
  it('bounds provider response work below ten seconds', () => expect(PROVIDER_DEADLINE_MS).toBe(9000));
  it('does not request catalogs for account or unsupported EPG checks', () => {
    expect(providerActions.has('')).toBe(false);
    expect(providerActions.has('get_short_epg')).toBe(false);
    expect(providerActions.has('get_live_streams')).toBe(true);
  });
  it('keeps customer list caching private and supports matching 304', async () => {
    const request = new Request('https://panel.example/player_api.php');
    const response = await privateListValidator(request, Response.json([{ direct_source: 'customer-specific' }]));
    expect(response.headers.get('cache-control')).toBe('private, max-age=0, must-revalidate');
    const etag = response.headers.get('etag');
    if (!etag) throw new Error('Missing validator');
    const cached = await privateListValidator(new Request(request.url, { headers: { 'If-None-Match': etag } }), Response.json([{ direct_source: 'customer-specific' }]));
    expect(cached.status).toBe(304);
    const changed = await privateListValidator(new Request(request.url, { headers: { 'If-None-Match': etag } }), Response.json([{ direct_source: 'other-customer' }]));
    expect(changed.status).toBe(200);
  });
  it('never makes account credentials or failures cacheable', async () => {
    const response = Response.json({ user_info: { password: 'test' } }, { headers: { 'Cache-Control': 'no-store' } });
    expect((await privateListValidator(new Request('https://panel.example'), response)).headers.get('cache-control')).toBe('no-store');
    expect((await privateListValidator(new Request('https://panel.example'), Response.json([], { status: 503 }))).headers.has('etag')).toBe(false);
  });
});