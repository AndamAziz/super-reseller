const SHORT_NAME = /^[\p{L}\p{N}._-]{1,700}\.mp4$/u;
const PATH_TTL_MS = 5 * 60_000;
const EDGE_TTL_S = 86_400;

// Short token-free public links: /api/public/v/<name>.mp4 redirects to the
// object in the public-videos bucket. The bucket itself is public, so the
// redirect target plays directly in VLC and other players.
// Speed: the redirect is kept in the shared edge cache (all instances in a
// data center), then a per-instance memory cache, and only then looked up
// with one lightweight database call (no client library import).
const pathCache = new Map<string, { path: string; at: number }>();

type EdgeCache = { match(k: Request): Promise<Response | undefined>; put(k: Request, r: Response): Promise<void> };
function edgeCache(): EdgeCache | null {
  const c = (globalThis as { caches?: { default?: EdgeCache } }).caches;
  return c?.default ?? null;
}

function storageBase() {
  return process.env['SUPABASE_URL'] || process.env['VITE_SUPABASE_URL'] || import.meta.env['VITE_SUPABASE_URL'];
}
function publishableKey() {
  return process.env['SUPABASE_PUBLISHABLE_KEY'] || process.env['VITE_SUPABASE_PUBLISHABLE_KEY'] || import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'];
}

export function redirectFor(base: string, path: string) {
  const target = `${base}/storage/v1/object/public/public-videos/${path.split('/').map(encodeURIComponent).join('/')}`;
  return new Response(null, { status: 302, headers: { Location: target, 'Cache-Control': `public, max-age=${EDGE_TTL_S}`, 'Access-Control-Allow-Origin': '*' } });
}

async function lookupPath(base: string, short: string): Promise<string | null> {
  const key = publishableKey();
  if (!key) return null;
  const res = await fetch(`${base}/rest/v1/rpc/public_video_path`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_short: short }),
  });
  if (!res.ok) return null;
  const data: unknown = await res.json();
  return typeof data === 'string' && data ? data : null;
}

export async function handlePublicVideoLink(rawName: string): Promise<Response> {
  let short = rawName;
  try { short = decodeURIComponent(rawName); } catch { return new Response('Not found', { status: 404 }); }
  if (!SHORT_NAME.test(short)) return new Response('Not found', { status: 404 });
  const base = storageBase();
  if (!base) return new Response('Storage unavailable', { status: 503 });

  const cacheKey = new Request(`https://video-link.cache/${encodeURIComponent(short)}`);
  const edge = edgeCache();
  const hit = await edge?.match(cacheKey).catch(() => undefined);
  if (hit) return hit;

  let entry = pathCache.get(short);
  if (!entry || Date.now() - entry.at > PATH_TTL_MS) {
    const path = await lookupPath(base, short).catch(() => null);
    if (!path) { pathCache.delete(short); return new Response('Not found', { status: 404 }); }
    entry = { path, at: Date.now() };
    pathCache.set(short, entry);
  }
  const response = redirectFor(base, entry.path);
  await edge?.put(cacheKey, response.clone()).catch(() => undefined);
  return response;
}
