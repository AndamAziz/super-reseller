import { authLine, loadCatalog, plain, type AuthResult } from "./playlist-auth.server";
import { checkStreamLimit, proxyFetch, allowedUrl, unb64u } from "./stream-proxy.server";
import type { MediaKind } from "./media";
import { resolveChannel } from "./media";

const authCache = new Map<string, { at: number; auth: AuthResult }>();
const AUTH_TTL_MS = 15_000;
async function cachedAuth(username: string, password: string): Promise<AuthResult> {
  const key = `${username}\n${password}`;
  const hit = authCache.get(key);
  if (hit && Date.now() - hit.at < AUTH_TTL_MS && hit.auth.ok && new Date(hit.auth.expiresAt).getTime() > Date.now()) return hit.auth;
  const auth = await authLine(username, password);
  if (auth.ok) {
    if (authCache.size > 5000) authCache.clear();
    authCache.set(key, { at: Date.now(), auth });
  } else authCache.delete(key);
  return auth;
}

export async function handleMediaPlayback(request: Request, username: string, password: string, stream: string, kind: MediaKind, segment = false): Promise<Response> {
  if (!/^\d+(?:\.[a-z0-9]+)?$/i.test(stream)) return plain("Invalid stream", 400);
  // Account check and catalog load are independent: run them together, and reuse a
  // recent successful account check for video pieces so each segment avoids a database trip.
  const [auth, loaded] = await Promise.all([segment ? cachedAuth(username, password) : authLine(username, password), loadCatalog()]);
  if (!auth.ok) return plain(auth.message, auth.status);
  const id = Number.parseInt(stream, 10);
  if (!loaded.ok) return plain(loaded.message, loaded.status);
  const items = kind === "live" ? loaded.catalog.live : kind === "movie" ? loaded.catalog.movies : loaded.catalog.episodes;
  const identity = new URL(request.url).searchParams.get("channel");
  if (identity && !/^[a-f0-9]{16}$/.test(identity)) return plain("Invalid channel", 400);
  const channel = resolveChannel(items, id, identity);
  if (!channel) return plain("Stream not found", 404);
  const streamKey = identity ?? String(id);
  const scope = kind === "live" ? `${auth.username}:${streamKey}` : `${auth.username}:${kind}:${streamKey}`;
  let target: URL;
  if (segment) {
    const params = new URL(request.url).searchParams;
    if (params.has("t")) {
      const { resolveDashTarget } = await import("./dash-manifest.server");
      const allowed = await resolveDashTarget(params, scope);
      if (!allowed) return plain("Forbidden DASH target", 403);
      target = allowed;
    } else {
    let raw: string;
    try { raw = unb64u(params.get("u") ?? ""); } catch { return plain("Bad url", 400); }
    const allowed = await allowedUrl(raw, params.get("s") ?? "", scope);
    if (!allowed) return plain("Forbidden target", 403);
    target = allowed;
    }
  } else {
    try { target = new URL(channel.url); } catch { return plain("Invalid source URL", 502); }
  }
  const limited = await checkStreamLimit(request, auth);
  if (limited) return limited;
  const prefix = `${new URL(request.url).origin}/api/public/media-proxy/${kind}/${encodeURIComponent(auth.username)}/${encodeURIComponent(auth.password)}/${id}${identity ? `?channel=${identity}` : ""}`;
  return proxyFetch(request, target, channel, prefix, scope, segment ? {} : { manifestRedirect: manifestRedirects(request.url, stream, id) });
}

/**
 * Provider-independent format mirroring, decided from the bytes the origin actually
 * returns (never from provider names or a blanket .ts → .m3u8 rewrite):
 * - an entry link such as `2902.ts` whose source answers with an HLS/DASH manifest is
 *   redirected to the same app link with `.m3u8` / `.mpd`;
 * - a manifest-style or extensionless link (e.g. an Xtream player asking for `7.m3u8`)
 *   whose source answers with raw MPEG-TS is redirected to the same app link with `.ts`.
 * The channel identity query is preserved; the origin URL (path, query, tokens) is
 * always fetched unchanged from the catalog.
 */
export function manifestRedirects(requestUrl: string, stream: string, id: number): Partial<Record<"hls" | "dash" | "ts", string>> {
  const ext = /\.([a-z0-9]+)$/i.exec(stream)?.[1]?.toLowerCase();
  const url = new URL(requestUrl);
  const swap = (next: string) => {
    const copy = new URL(url);
    copy.pathname = copy.pathname.replace(/\/[^/]*$/, `/${id}.${next}`);
    return copy.toString();
  };
  const out: Partial<Record<"hls" | "dash" | "ts", string>> = {};
  if (ext !== "m3u8" && ext !== "m3u") out.hls = swap("m3u8");
  if (ext !== "mpd") out.dash = swap("mpd");
  if (!ext || ext === "m3u8" || ext === "m3u" || ext === "mpd") out.ts = swap("ts");
  return out;
}

export const playbackOptions = () => new Response(null, { status: 204, headers: {
  "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Range", "Access-Control-Allow-Methods": "GET, OPTIONS",
} });