import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock('@/integrations/supabase/client.server', () => ({
  supabaseAdmin: { from: () => {
    const chain = {
      select: () => chain, eq: () => chain, gte: () => chain, abortSignal: () => chain,
      maybeSingle: () => mocks.read(),
      then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => mocks.read().then(resolve, reject),
    };
    return chain;
  } },
}));
import { authLine, countActiveConnections, loadSourceText } from '@/lib/playlist-auth.server';
import { handleXtreamRequest } from '@/routes/player_api[.]php';

const line = { id: 'fixture', username: 'fixture', password: 'fixture', expires_at: '2099-01-01T00:00:00Z', created_at: null, max_connections: 6 };
const good = { data: line, error: null, status: 200 };
const outage = { data: null, error: { message: 'Unavailable' }, status: 503 };
beforeEach(() => { mocks.read.mockReset(); vi.unstubAllGlobals(); });

describe('provider outage recovery without changing customer access', () => {
  it('retries a transient account lookup and keeps the saved connection limit', async () => {
    mocks.read.mockResolvedValueOnce(outage).mockResolvedValueOnce(good);
    expect(await authLine('fixture', 'fixture')).toMatchObject({ ok: true, maxConnections: 6 });
    expect(mocks.read).toHaveBeenCalledTimes(2);
  });
  it('does not retry invalid credentials or enable an expired subscription', async () => {
    mocks.read.mockResolvedValue(good);
    expect(await authLine('fixture', 'wrong')).toMatchObject({ ok: false, status: 401 });
    expect(mocks.read).toHaveBeenCalledTimes(1);
    mocks.read.mockResolvedValue({ ...good, data: { ...line, expires_at: '2000-01-01T00:00:00Z' } });
    expect(await authLine('fixture', 'fixture')).toMatchObject({ ok: false, status: 403 });
  });
  it('never labels returned or thrown account-service failures as invalid credentials', async () => {
    mocks.read.mockResolvedValue(outage);
    expect(await authLine('fixture', 'fixture')).toMatchObject({ ok: false, status: 503 });
    mocks.read.mockRejectedValue(new Error('Network failure'));
    expect(await authLine('fixture', 'fixture')).toMatchObject({ ok: false, status: 503 });
  });
  it('returns a retryable response rather than auth:0 during service outages', async () => {
    mocks.read.mockResolvedValue(outage);
    const response = await handleXtreamRequest(new Request('https://panel.example/api/public/player_api.php?username=fixture&password=fixture'));
    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('2');
    expect(await response.json()).not.toHaveProperty('user_info');
  });
  it('does not fabricate zero devices when the connection service fails', async () => {
    mocks.read.mockResolvedValue(outage);
    await expect(countActiveConnections('fixture')).rejects.toThrow('Connection status temporarily unavailable');
  });
  it('handles a thrown device-count failure with a controlled response', async () => {
    mocks.read.mockResolvedValueOnce(good).mockRejectedValue(new Error('Network failure'));
    const response = await handleXtreamRequest(new Request('https://panel.example/api/public/player_api.php?username=fixture&password=fixture'));
    expect(response.status).toBe(503);
  });
  it('distinguishes unavailable settings from missing configuration', async () => {
    mocks.read.mockResolvedValue(outage);
    expect(await loadSourceText()).toMatchObject({ ok: false, status: 503, message: 'Playlist configuration temporarily unavailable' });
  });
  it('retries a temporary GitHub failure with the original playlist bytes', async () => {
    mocks.read.mockResolvedValue({ data: { value: 'https://raw.githubusercontent.com/example/main/playlist.m3u' }, error: null, status: 200 });
    const fetcher = vi.fn().mockResolvedValueOnce(new Response('Temporary', { status: 503 }))
      .mockResolvedValueOnce(new Response('#EXTM3U\n#EXTINF:-1,Original\nhttps://media.example/live.ts'));
    vi.stubGlobal('fetch', fetcher);
    expect(await loadSourceText()).toEqual({ ok: true, text: '#EXTM3U\n#EXTINF:-1,Original\nhttps://media.example/live.ts' });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0]?.[1].signal).toBeInstanceOf(AbortSignal);
  });
  it('never retries a permanent missing source', async () => {
    mocks.read.mockResolvedValue({ data: { value: 'https://raw.githubusercontent.com/example/main/playlist.m3u' }, error: null, status: 200 });
    const fetcher = vi.fn().mockResolvedValue(new Response('Missing', { status: 404 }));
    vi.stubGlobal('fetch', fetcher);
    expect(await loadSourceText()).toMatchObject({ ok: false, status: 502 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});