const SHORT_NAME = /^[\p{L}\p{N}._-]{1,700}\.mp4$/u;

// Short token-free public links: /api/public/v/<name>.mp4 redirects to the
// object in the public-videos bucket. The bucket itself is public, so the
// redirect target plays directly in VLC and other players.
export async function handlePublicVideoLink(rawName: string): Promise<Response> {
  let short = rawName;
  try { short = decodeURIComponent(rawName); } catch { return new Response('Not found', { status: 404 }); }
  if (!SHORT_NAME.test(short)) return new Response('Not found', { status: 404 });
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data, error } = await supabaseAdmin.rpc('public_video_path', { p_short: short });
  if (error || typeof data !== 'string' || !data) return new Response('Not found', { status: 404 });
  const base = process.env['SUPABASE_URL'] || process.env['VITE_SUPABASE_URL'] || import.meta.env['VITE_SUPABASE_URL'];
  if (!base) return new Response('Storage unavailable', { status: 503 });
  const target = `${base}/storage/v1/object/public/public-videos/${data.split('/').map(encodeURIComponent).join('/')}`;
  return new Response(null, { status: 302, headers: { Location: target, 'Cache-Control': 'public, max-age=300' } });
}
