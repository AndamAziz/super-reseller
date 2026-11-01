const SHORT_NAME = /^[\p{L}\p{N}._-]{1,700}\.mp4$/u;

// Short token-free public links: /api/public/v/<name>.mp4 redirects to the
// object in the public-videos bucket. The bucket itself is public, so the
// redirect target plays directly in VLC and other players.
const pathCache = new Map<string, { path: string; at: number }>();
const PATH_TTL_MS = 5 * 60_000;

export async function handlePublicVideoLink(rawName: string): Promise<Response> {
  let short = rawName;
  try { short = decodeURIComponent(rawName); } catch { return new Response('Not found', { status: 404 }); }
  if (!SHORT_NAME.test(short)) return new Response('Not found', { status: 404 });
  let data = pathCache.get(short);
  if (!data || Date.now() - data.at > PATH_TTL_MS) {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const res = await supabaseAdmin.rpc('public_video_path', { p_short: short });
    if (res.error || typeof res.data !== 'string' || !res.data) { pathCache.delete(short); return new Response('Not found', { status: 404 }); }
    data = { path: res.data, at: Date.now() };
    pathCache.set(short, data);
  }
  const base = process.env['SUPABASE_URL'] || process.env['VITE_SUPABASE_URL'] || import.meta.env['VITE_SUPABASE_URL'];
  if (!base) return new Response('Storage unavailable', { status: 503 });
  const target = `${base}/storage/v1/object/public/public-videos/${data.path.split('/').map(encodeURIComponent).join('/')}`;
  return new Response(null, { status: 302, headers: { Location: target, 'Cache-Control': 'public, max-age=300', 'Access-Control-Allow-Origin': '*' } });
}
