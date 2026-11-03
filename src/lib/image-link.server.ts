// Short public image links: https://re.andam.uk/api/public/i/<name> redirects (302)
// to the permanent public storage object. The object name is an unguessable random
// hex id generated at upload time, so validating the shape is enough authorization.
const IMAGE_SHORT_NAME = /^[a-f0-9]{16,64}\.(?:jpg|jpeg|png|webp)$/i;

function imageStorageBase(): string {
  return process.env['SUPABASE_URL'] || process.env['VITE_SUPABASE_URL'] || import.meta.env['VITE_SUPABASE_URL'];
}

export function handleImageLink(rawName: string): Response {
  let name = rawName;
  try { name = decodeURIComponent(rawName); } catch { return new Response('Not found', { status: 404 }); }
  if (!IMAGE_SHORT_NAME.test(name)) return new Response('Not found', { status: 404 });
  const base = imageStorageBase();
  if (!base) return new Response('Not found', { status: 404 });
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${base}/storage/v1/object/public/channel-images/${name}`,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
