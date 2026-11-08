import { z } from 'zod';

export const PORTAL_URL = 'https://re.andam.uk/api/public/c/';
export const macSchema = z.string().trim().toUpperCase().regex(/^00:1A:79:([0-9A-F]{2}:){2}[0-9A-F]{2}$/, 'MAC must be 00:1A:79:XX:XX:XX');
export const accountTypeSchema = z.enum(['xtream', 'mac', 'both']);
export type AccountType = z.infer<typeof accountTypeSchema>;
export const accountLabels: Record<AccountType, string> = { xtream: 'Xtream (username/password)', mac: 'MAC Portal', both: 'Both' };
export function generateMac() {
  const bytes = crypto.getRandomValues(new Uint8Array(3));
  return `00:1A:79:${Array.from(bytes, b => b.toString(16).padStart(2, '0').toUpperCase()).join(':')}`;
}
export function requestMac(request: Request): string | null {
  const query = new URL(request.url).searchParams.get('mac');
  const cookie = request.headers.get('cookie')?.split(';').map(v => v.trim()).find(v => v.startsWith('mac='))?.slice(4);
  try {
    const parsed = macSchema.safeParse(query ?? decodeURIComponent(cookie ?? ''));
    return parsed.success ? parsed.data : null;
  } catch { return null; }
}
export const PORTAL_PAGE_SIZE = 14;
export function portalPage<T>(items: T[], page: number) {
  const current = Math.max(1, page);
  return { total_items: items.length, max_page_items: PORTAL_PAGE_SIZE, selected_item: 0, cur_page: current, data: items.slice((current - 1) * PORTAL_PAGE_SIZE, current * PORTAL_PAGE_SIZE) };
}