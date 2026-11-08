import { z } from 'zod';
import { loadCatalog } from './playlist-auth.server';
import { requestMac } from './mac-portal';
import { portalCatalogResponse, type PortalAccount } from './mac-portal-catalog';

const parameters = z.object({ type: z.string().max(30).default(''), action: z.string().max(50).default(''), genre: z.string().max(20).optional(), category: z.string().max(20).optional(), p: z.coerce.number().int().min(1).max(100000).optional(), cmd: z.string().max(2000).optional(), movie_id: z.string().max(30).optional(), season_id: z.string().max(50).optional(), ch_id: z.string().max(30).optional() });
const accountSchema = z.object({ lineId: z.string().uuid(), id: z.number(), username: z.string(), password: z.string(), mac: z.string(), expiresAt: z.string(), maxConnections: z.number() });
const catalogActions = new Set(['itv:get_genres', 'itv:get_all_channels', 'itv:get_ordered_list', 'itv:create_link', 'vod:get_categories', 'vod:get_ordered_list', 'vod:create_link', 'series:get_categories', 'series:get_ordered_list', 'series:create_link']);
export const portalHeaders = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type' };
const respond = (js: unknown) => new Response(JSON.stringify({ js }), { status: 200, headers: portalHeaders });
function randomHex() { return Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join(''); }
async function tokenHash(token: string) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))), b => b.toString(16).padStart(2, '0')).join(''); }

export async function handleMacPortal(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: portalHeaders });
  try {
    const url = new URL(request.url);
    if (request.method === 'POST') {
      if (Number(request.headers.get('content-length') ?? 0) > 8192) return respond({ error: 'Invalid request' });
      const body = await request.text();
      if (body.length > 8192) return respond({ error: 'Invalid request' });
      new URLSearchParams(body).forEach((v, k) => url.searchParams.set(k, v));
    }
    const parsed = parameters.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) return respond({ error: 'Invalid request' });
    const mac = requestMac(new Request(url, { headers: request.headers }));
    if (!mac) return respond({ error: 'Invalid MAC address' });
    const handshake = parsed.data.type === 'stb' && parsed.data.action === 'handshake';
    const bearer = /^Bearer ([0-9a-f]{32})$/i.exec(request.headers.get('authorization') ?? '')?.[1];
    if (!handshake && !bearer) return respond({ error: 'Invalid or expired token' });
    const token = handshake ? randomHex() : bearer;
    if (!token) return respond({ error: 'Invalid or expired token' });
    const hash = await tokenHash(token);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data, error } = await supabaseAdmin.rpc('authorize_mac_portal', { _mac: mac, ...(handshake ? { _new_token_hash: hash } : { _token_hash: hash }), _ip: request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '' }).abortSignal(AbortSignal.timeout(6500));
    if (error) return respond({ error: 'Portal temporarily unavailable; retry shortly' });
    if (data && typeof data === 'object' && !Array.isArray(data) && 'error' in data) return respond({ error: data['error'] });
    const account: PortalAccount = accountSchema.parse(data);
    if (handshake) return respond({ token, random: randomHex() });
    const key = `${parsed.data.type}:${parsed.data.action}`;
    const expiry = new Date(account.expiresAt).toISOString().replace('T', ' ').slice(0, 19);
    if (key === 'stb:get_profile') return respond({ id: account.id, name: account.username, mac: account.mac, status: 0, blocked: '0', expire_billing_date: expiry });
    if (key === 'account_info:get_main_info') return respond({ mac: account.mac, phone: expiry });
    if (key === 'watchdog:get_events') return respond({ data: { msgs: 0 } });
    if (!catalogActions.has(key)) return respond([]);
    const loaded = await loadCatalog();
    if (!loaded.ok) return respond({ error: 'Catalog temporarily unavailable; retry shortly' });
    return respond(portalCatalogResponse(loaded.catalog, url.searchParams, account, url.origin));
  } catch { return respond({ error: 'Portal temporarily unavailable; retry shortly' }); }
}