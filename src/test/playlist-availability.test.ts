import { describe, expect, it, vi } from 'vitest';
import { createPlaylistCache } from '@/lib/playlist-cache';

describe('shared reseller catalog availability', () => {
  it('serves the last-good list immediately to all concurrent customers during a stalled refresh', async () => {
    let at = 0;
    let finish: ((value: string[]) => void) | undefined;
    const load = vi.fn().mockResolvedValueOnce(['working']).mockImplementationOnce(() => new Promise<string[]>(resolve => { finish = resolve; }));
    const read = createPlaylistCache<string[]>(load, () => at);
    await read();
    at = 5_000;
    const refresh = read();
    expect(await Promise.all(Array.from({ length: 20 }, () => read()))).toEqual(Array.from({ length: 20 }, () => ['working']));
    expect(load).toHaveBeenCalledTimes(2);
    finish?.(['updated']);
    expect(await refresh).toEqual(['updated']);
    expect(await read()).toEqual(['updated']);
  });
  it('retains the same list after a refresh outage and recovers after five seconds', async () => {
    let at = 0;
    const load = vi.fn().mockResolvedValueOnce(['working']).mockRejectedValueOnce(new Error('outage')).mockResolvedValueOnce(['recovered']);
    const read = createPlaylistCache<string[]>(load, () => at);
    await read();
    at = 5_000;
    expect(await read()).toEqual(['working']);
    at = 9_999;
    expect(await read()).toEqual(['working']);
    expect(load).toHaveBeenCalledTimes(2);
    at = 10_000;
    expect(await read()).toEqual(['recovered']);
  });
  it('does not poison cold starts after a synchronous source failure', async () => {
    const load = vi.fn().mockImplementationOnce(() => { throw new Error('offline'); }).mockResolvedValueOnce(['recovered']);
    const read = createPlaylistCache<string[]>(load);
    await expect(read()).rejects.toThrow('offline');
    expect(await read()).toEqual(['recovered']);
    expect(load).toHaveBeenCalledTimes(2);
  });
  it('keeps forced reads on the refresh while normal reads get the last-good list', async () => {
    let finish: ((value: string[]) => void) | undefined;
    const load = vi.fn().mockResolvedValueOnce(['old']).mockImplementationOnce(() => new Promise<string[]>(resolve => { finish = resolve; }));
    const read = createPlaylistCache<string[]>(load);
    await read();
    const forced = read(true);
    await Promise.resolve();
    expect(await read()).toEqual(['old']);
    finish?.(['new']);
    expect(await forced).toEqual(['new']);
  });
});