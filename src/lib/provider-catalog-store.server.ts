import type { Catalog } from './playlist-auth.server';
import type { Json } from '@/integrations/supabase/types';
import { buildCatalog } from './playlist-auth.server';
import { deflateSync, inflateSync } from 'node:zlib';

// Storage compression only, NEVER HTTP response compression. Avoid storing duplicated live/episode arrays.
function encodeCatalog(catalog: Catalog): Json {
  return { encoding: 'deflate-base64', data: deflateSync(JSON.stringify({ channels: catalog.channels, version: catalog.version })).toString('base64') };
}
function decodeCatalog(value: Json): Catalog {
  const encoded = value as { encoding?: string; data?: string };
  if (encoded.encoding !== 'deflate-base64' || !encoded.data) return value as unknown as Catalog;
  const parsed = JSON.parse(inflateSync(Buffer.from(encoded.data, 'base64')).toString()) as Pick<Catalog, 'channels' | 'version'>;
  return { ...buildCatalog(parsed.channels), ...(parsed.version ? { version: parsed.version } : {}) };
}

export const CATALOG_REFRESH_MS = 300_000;
let local: Catalog | undefined;
let localReadAt = 0;
/** etag (or checked_at) of the stored row that `local` was decoded from. */
let localStamp: string | undefined;
let stampValue: { stamp: string | null; at: number } | undefined;

const stampOf = (row: { etag: string | null; checked_at: string }) => row.etag || row.checked_at;

/**
 * Cheap identity of the stored catalog (its GitHub etag, else checked_at), read without the
 * ~2 MB catalog column. Decoding the catalog costs ~230 ms of CPU, so readers compare this first.
 */
export async function catalogStamp(maxAgeMs = 15_000): Promise<string | null> {
  if (stampValue && Date.now() - stampValue.at < maxAgeMs) return stampValue.stamp;
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data, error } = await supabaseAdmin.from('provider_catalog_cache').select('etag, checked_at').eq('key', 'github').abortSignal(AbortSignal.timeout(2000)).maybeSingle();
  if (error) throw new Error('Stored playlist temporarily unavailable');
  stampValue = { stamp: data ? stampOf(data) : null, at: Date.now() };
  return stampValue.stamp;
}
let loading: Promise<Catalog> | undefined;
let refreshing: Promise<Catalog> | undefined;

async function stored() {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data, error } = await supabaseAdmin.from('provider_catalog_cache').select('*').eq('key', 'github').abortSignal(AbortSignal.timeout(2000)).maybeSingle();
  if (error) throw new Error('Stored playlist temporarily unavailable');
  return data;
}

/** Customer reads never call GitHub, including cold instances. */
export async function readStoredCatalog(forceReload = false): Promise<Catalog> {
  if (local && !forceReload && Date.now() - localReadAt < 60_000) return local;
  // Never await another request's promise (Workers drop it when that request ends).
  if (loading && local && !forceReload) return local;
  let own!: Promise<Catalog>;
  own = (async () => {
    try {
      // Unchanged since the last decode: keep the decoded copy (no 26 MB inflate + parse).
      if (local && localStamp && !forceReload) {
        const stamp = await catalogStamp(0).catch(() => null);
        if (stamp && stamp === localStamp) { localReadAt = Date.now(); return local; }
      }
      const row = await stored();
      if (!row) throw new Error('Playlist cache is not ready; retry shortly');
      local = decodeCatalog(row.catalog);
      localStamp = stampOf(row);
      localReadAt = Date.now();
      return local;
    } catch (error) { if (local) return local; throw error; }
    finally { if (loading === own) loading = undefined; }
  })();
  loading = own;
  return own;
}

/** Only the authenticated schedule or role-checked admin refresh may call this. */
export async function refreshStoredCatalog(parse: (text: string) => Promise<Catalog>, force = false): Promise<Catalog> {
  if (refreshing && local) return local;
  let own!: Promise<Catalog>;
  own = (async () => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    let previous: Awaited<ReturnType<typeof stored>> = null;
    try {
      previous = await stored();
      if (!force && previous && Date.now() - Date.parse(previous.checked_at) < CATALOG_REFRESH_MS) {
        local = decodeCatalog(previous.catalog);
        return local;
      }
      const { data: settings, error } = await supabaseAdmin.from('app_settings').select('value').eq('key', 'm3u_source_url').abortSignal(AbortSignal.timeout(1500)).maybeSingle();
      if (error || !settings?.value) throw new Error('Playlist configuration unavailable');
      const sameSource = previous?.source_url === settings.value;
      const headers = new Headers();
      if (sameSource && previous?.etag) headers.set('If-None-Match', previous.etag);
      let response: Response | undefined;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          response = await fetch(settings.value, { headers, signal: AbortSignal.timeout(2000) });
          if (attempt === 0 && [429, 502, 503, 504].includes(response.status)) { await response.body?.cancel(); continue; }
          break;
        } catch (error) { if (attempt === 1) throw error; }
      }
      if (!response) throw new Error('Playlist source unavailable');
      const checked_at = new Date().toISOString();
      if (response.status === 304 && previous && sameSource) {
        const { error: writeError } = await supabaseAdmin.from('provider_catalog_cache').update({ checked_at }).eq('key', 'github').abortSignal(AbortSignal.timeout(1500));
        if (writeError) throw new Error('Playlist cache update failed');
        local = decodeCatalog(previous.catalog);
        localStamp = stampOf({ etag: previous.etag, checked_at });
      } else {
        if (!response.ok) { await response.body?.cancel(); throw new Error(`Playlist source HTTP ${response.status}`); }
        const catalog = await parse(await response.text());
        if (!catalog.channels.length) throw new Error('Playlist contains no playable entries');
        const { error: writeError } = await supabaseAdmin.from('provider_catalog_cache').upsert({ key: 'github', source_url: settings.value, etag: response.headers.get('etag'), checked_at, catalog: encodeCatalog(catalog) }).abortSignal(AbortSignal.timeout(4000));
        if (writeError) { console.warn('provider_catalog_store_error', writeError.code, writeError.message); throw new Error('Playlist cache save failed'); }
        local = catalog;
        localStamp = stampOf({ etag: response.headers.get('etag'), checked_at });
      }
      localReadAt = Date.now();
      stampValue = undefined;
      return local;
    } catch (error) {
      console.warn('provider_catalog_refresh_failed', error instanceof Error ? error.message : 'Unavailable');
      if (previous) { local = decodeCatalog(previous.catalog); return local; }
      if (local) return local;
      throw error;
    } finally { if (refreshing === own) refreshing = undefined; }
  })();
  refreshing = own;
  return own;
}