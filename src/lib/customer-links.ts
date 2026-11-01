const LIVE_HOST = 'https://super-reseller.lovable.app';

export function customerLinks(line: { username: string; password: string; custom_host: string | null }) {
  let host = line.custom_host?.trim() || LIVE_HOST;
  if (!/^https?:\/\//i.test(host)) host = `https://${host}`;
  const url = new URL(host);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid customer host');
  const base = `${url.origin}${url.pathname.replace(/\/+$/, '').replace(/\/api\/public(?:\/.*)?$/, '')}/api/public`;
  const credentials = new URLSearchParams({ username: line.username, password: line.password }).toString();
  return { provider: base, m3u: `${base}/playlist?${credentials}`, content: `${base}/content?${credentials}&provider_key=github` };
}