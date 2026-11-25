export const PROVIDER_DEADLINE_MS = 9_000;
export const providerActions = new Set(['get_live_categories', 'get_live_streams', 'get_vod_categories', 'get_vod_streams', 'get_vod_info', 'get_series_categories', 'get_series', 'get_series_info']);
export function providerRequestType(action: string) {
  if (!action) return 'account';
  if (action.endsWith('_categories')) return 'categories';
  if (action.startsWith('get_vod')) return 'movies';
  if (action.startsWith('get_series')) return 'series';
  if (action === 'get_live_streams') return 'streams';
  return 'other';
}
/** Authenticate before calling: validators must never bypass expiry or password checks. */
export async function privateListValidator(request: Request, response: Response) {
  if (response.status !== 200 || response.headers.get('retry-after')) return response;
  if (response.headers.get('etag')) return response; // templated lists set their own ETag
  const body = await response.clone().text();
  if (!body.startsWith('[')) return response;
  const bytes = new TextEncoder().encode(body);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  const etag = `"${Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('')}"`;
  response.headers.set('ETag', etag);
  response.headers.set('Cache-Control', 'private, max-age=0, must-revalidate');
  const matches = request.headers.get('if-none-match')?.split(',').map(s => s.trim().replace(/^W\//, '')).includes(etag);
  return matches ? new Response(null, { status: 304, headers: response.headers }) : response;
}