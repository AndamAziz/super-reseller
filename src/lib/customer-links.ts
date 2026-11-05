const LIVE_HOST = 'https://re.andam.uk';
// Old hosting address redirects (302) to the primary domain; always hand customers the primary host.
const REDIRECTING_HOSTS = new Set(['super-reseller.lovable.app']);

export function customerLinks(line: { username: string; password: string; custom_host: string | null }) {
  let host = line.custom_host?.trim() || LIVE_HOST;
  if (!/^https?:\/\//i.test(host)) host = `https://${host}`;
  let url = new URL(host);
  if (REDIRECTING_HOSTS.has(url.hostname)) url = new URL(url.pathname, LIVE_HOST);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid customer host');
  const base = `${url.origin}${url.pathname.replace(/\/+$/, '').replace(/\/api\/public(?:\/.*)?$/, '')}/api/public`;
  const credentials = new URLSearchParams({ username: line.username, password: line.password }).toString();
  return { provider: base, m3u: `${base}/playlist?${credentials}`, content: `${base}/content?${credentials}&provider_key=github` };
}