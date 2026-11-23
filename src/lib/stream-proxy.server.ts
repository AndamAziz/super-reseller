// Header-injecting HLS proxy for channels that require Referer / User-Agent.
import type { M3UChannel } from "./m3u";
import { plain } from "./playlist-auth.server";
import { mediaContentType } from "./media";
import { detectMedia, protocolMime } from "./media-detection";
import { peekStream } from "./stream-peek";

export const needsProxy = (c: M3UChannel) => !!(c.referrer?.trim() || c.user_agent?.trim());

/** IPv6 devices rotate privacy addresses inside one /64, so the /64 identifies the household. */
export function deviceIp(ip: string): string {
  ip = ip.trim().toLowerCase();
  if (!ip.includes(":")) return ip;
  const [head, tail = ""] = ip.split("::");
  const h = head ? head.split(":") : [];
  const t = tail ? tail.split(":") : [];
  const full = ip.includes("::") ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill("0"), ...t] : h;
  return full.slice(0, 4).map((x) => x.replace(/^0+(?=.)/, "")).join(":") + "::/64";
}
/** The viewer's address, taken only from CF-Connecting-IP, which Cloudflare's edge sets and
 * overwrites itself. Client-sent headers (X-Forwarded-For, X-Real-IP, True-Client-IP) are never
 * trusted, so nobody can fake an address to bypass the limit. */
export function viewerIp(headers: Headers): string {
  return headers.get("cf-connecting-ip")?.trim() ?? "";
}

/** Stable per-device key: line + viewer IP (Web Crypto — workerd-safe). One key per viewer, shared by
 * every playlist and segment request and replaced in place when the viewer switches channel. */
async function clientInfo(request: Request, username: string): Promise<{ key: string; ua: string; ip: string }> {
  const ip = viewerIp(request.headers);
  const ua = request.headers.get("user-agent") ?? "";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${username}|${ip ? deviceIp(ip) : ua}`));
  const key = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
  return { key, ua, ip };
}

/**
 * Enforce a line's Max connections. Counts one active connection per device
 * (line + IP + user-agent) seen in the last 45 seconds. Returns null when the
 * stream may proceed, or a 429 response when the line is already at its limit.
 */
// Devices recently admitted (per worker instance). Re-checking every video piece added a
// database round trip per segment; a 15s refresh still keeps the 45s activity window alive.
const admitted = new Map<string, number>();
const ADMIT_TTL_MS = 15_000;

export async function checkStreamLimit(request: Request, line: { username: string; maxConnections: number; lineId?: string }): Promise<Response | null> {
  const { key, ua, ip } = await clientInfo(request, line.username);
  const cacheKey = `${line.username}|${line.maxConnections}|${key}`;
  const seen = admitted.get(cacheKey);
  if (seen && Date.now() - seen < ADMIT_TTL_MS) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let lineId = line.lineId;
  if (!lineId) {
    const { data: row } = await supabaseAdmin.from("lines").select("id").eq("username", line.username).maybeSingle();
    if (!row) return null; // line vanished — authLine already validated it, fail open
    lineId = row.id;
  }
  const { data, error } = await supabaseAdmin.rpc("check_stream_limit", {
    _line_id: lineId,
    _client_key: key,
    _max: line.maxConnections,
    _user_agent: ua,
    _ip: ip,
  });
  if (error) return null; // never break playback on a bookkeeping error
  if (data === false) return plain("Max connections reached for this line", 429);
  if (admitted.size > 5000) admitted.clear();
  admitted.set(cacheKey, Date.now());
  return null;
}

const b64u = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const unb64u = (s: string) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

function isPrivateHost(h: string) {
  h = h.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal") || h.endsWith(".local")) return true;
  if (h.includes(":")) return h === "::1" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80") || h === "::";
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(h);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

/** Host written as a numeric IPv4/IPv6 address rather than a domain name. */
export function isIpLiteral(h: string): boolean {
  h = h.replace(/^\[|\]$/g, "");
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(h) || h.includes(":");
}

/** Chain signature: every URL we emit in a rewritten playlist is HMAC-signed for (user, stream). */
async function hmacKey() {
  const secret = process.env["SUPABASE_SERVICE_ROLE_KEY"] || process.env["SUPABASE_URL"] || "stream-proxy";
  return crypto.subtle.importKey("raw", new TextEncoder().encode(`proxy:${secret}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}
export async function signTarget(scope: string, url: string): Promise<string> {
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(), new TextEncoder().encode(`${scope}\n${url}`));
  return b64u(String.fromCharCode(...new Uint8Array(sig).slice(0, 18)));
}

/** Allowed: http(s), public host, and signed by us for this user+stream (i.e. came from the channel's playlist chain). */
export async function allowedUrl(target: string, sig: string, scope: string): Promise<URL | null> {
  let u: URL;
  try { u = new URL(target); } catch { return null; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (isPrivateHost(u.hostname)) return null;
  if (!sig || sig !== (await signTarget(scope, u.toString()))) return null;
  return u;
}

const isTag = (t: string) => t.startsWith("#") || /^EXT-?X?-?[A-Z-]*:/i.test(t) || /^EXTM3U$/i.test(t);

const HINT_EXTENSIONS = new Set(["m3u8", "ts", "aac", "ac3", "ec3", "mp4", "m4s", "m4a", "m4v", "mp3", "vtt", "webvtt", "key", "cmfv", "cmfa"]);

/** Give a proxied URI the same file extension as its origin URI, so players that pick a demuxer by extension behave as with the direct link. */
export function withExtensionHint(prefix: string, target: string): string {
  let ext: string | undefined;
  try { ext = /\.([a-z0-9]{2,6})$/i.exec(new URL(target).pathname)?.[1]?.toLowerCase(); } catch { return prefix; }
  if (!ext || !HINT_EXTENSIONS.has(ext)) return prefix;
  const q = prefix.indexOf("?");
  const path = q < 0 ? prefix : prefix.slice(0, q);
  if (!/\/\d+$/.test(path)) return prefix;
  return `${path}.${ext}${q < 0 ? "" : prefix.slice(q)}`;
}

export async function rewritePlaylist(text: string, from: string, prefix: string, scope: string): Promise<string> {
  const abs = async (uri: string) => {
    const full = new URL(uri.trim(), from).toString();
    const p = withExtensionHint(prefix, full);
    return `${p}${p.includes("?") ? "&" : "?"}u=${b64u(full)}&s=${await signTarget(scope, full)}`;
  };
  const out: string[] = [];
  for (const line of text.replace(/^\uFEFF/, "").split(/\r\n|\r|\n/)) {
    const t = line.trim();
    if (!t) { out.push(line); continue; }
    if (isTag(t)) {
      if (/^#EXT-X-(KEY|MAP|MEDIA|SESSION-KEY|I-FRAME-STREAM-INF):/i.test(t) && /URI="/.test(t)) {
        const m = /URI="([^"]+)"/.exec(t);
        if (m?.[1]) out.push(t.replace(m[0], `URI="${await abs(m[1])}"`));
        else out.push(line);
      } else out.push(line);
      continue;
    }
    try { out.push(await abs(t)); } catch { out.push(line); }
  }
  return out.join("\n");
}

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Expose-Headers": "Content-Length, Content-Range" };

export interface ProxyOptions {
  /**
   * When the origin answers with a manifest but the player asked for a URL with a
   * different extension (e.g. `.ts` that redirects to `.m3u8` upstream), send the
   * player to an equivalent app URL with the manifest's extension, exactly as the
   * origin does for direct playback. Players that choose their engine from the URL
   * extension would otherwise try to demux HLS text as MPEG-TS.
   */
  manifestRedirect?: Partial<Record<"hls" | "dash" | "ts", string>>;
}

function directSource(url: URL): Response {
  return new Response(null, { status: 302, headers: { ...CORS, Location: url.toString(), "Cache-Control": "no-store", "X-Media-Protocol": "hls" } });
}

/** Fetch target with the channel's headers; rewrite playlists, stream everything else. */
export async function proxyFetch(request: Request, target: URL, channel: M3UChannel, prefix: string, scope: string, options: ProxyOptions = {}): Promise<Response> {
  let original: URL | null = null;
  try { original = new URL(channel.url); } catch { /* the normal target validation below reports the error */ }
  const isOriginal = original?.toString() === target.toString();
  const textSource = !!original && /\.txt$/i.test(original.pathname);
  const hlsSource = !!original && /\.(?:m3u8|m3u)$/i.test(original.pathname);
  const handoffOriginal = () => {
    if (!original || !isOriginal || original.protocol !== "http:" && original.protocol !== "https:" || isPrivateHost(original.hostname)) return null;
    return directSource(original);
  };
  // The hosted fetch to some text-named HLS origins is rejected even though the
  // player's direct request works. Hand off the original entry before fetching it.
  if (isOriginal && textSource) return handoffOriginal() ?? plain("Forbidden target", 403);
  const hlsFallback = () => isOriginal && hlsSource ? handoffOriginal() : null;
  const headers: Record<string, string> = { "User-Agent": channel.user_agent?.trim() || "Mozilla/5.0" };
  if (channel.referrer?.trim()) {
    headers["Referer"] = channel.referrer.trim();
    if (!textSource) {
      try { headers["Origin"] = new URL(channel.referrer.trim()).origin; } catch { /* ignore */ }
    }
  }
  const range = request.headers.get("range");
  if (range) headers["Range"] = range;
  // Follow redirects manually so every hop is checked against private/local addresses.
  let res: Response | null = null;
  let current = target;
  try {
    for (let hop = 0; hop < 6; hop++) {
      if (isPrivateHost(current.hostname)) return plain("Forbidden target", 403);
      // The hosting refuses server-side fetches to bare IP addresses (403), so for any public
      // IP-addressed origin hand the player the origin URL itself, exactly like direct playback.
      if (isIpLiteral(current.hostname)) {
        return new Response(null, { status: 302, headers: { ...CORS, Location: current.toString(), "Cache-Control": "no-store", "X-Media-Protocol": "direct" } });
      }
      for (let attempt = 0; attempt < 2; attempt++) {
        // Limit time to receive headers, not the lifetime of an MP3/MP4 body.
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        try {
          res = await fetch(current, { headers, redirect: "manual", signal: controller.signal });
        } catch (error) {
          if (attempt === 1) throw error;
          continue;
        } finally { clearTimeout(timer); }
        if (attempt === 0 && [502, 503, 504].includes(res.status)) {
          await res.body?.cancel();
          continue;
        }
        break;
      }
      if (!res) return hlsFallback() ?? plain("Stream origin unreachable", 502);
      const loc = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
      if (!loc) break;
      current = new URL(loc, current);
      if (current.protocol !== "http:" && current.protocol !== "https:") return plain("Forbidden target", 403);
      res = null;
    }
  } catch {
    return hlsFallback() ?? plain("Stream origin unreachable", 502);
  }
  if (!res) return hlsFallback() ?? plain("Too many redirects", 502);
  if (!res.ok && res.status !== 206) {
    const fallback = hlsFallback();
    if (fallback) {
      await res.body?.cancel().catch(() => undefined);
      return fallback;
    }
    return plain(`Stream origin error (HTTP ${res.status})`, 502);
  }
  const ct = res.headers.get("content-type") ?? "";
  // Do not inspect nonzero byte ranges as if they start at a container header.
  const startsAtZero = !range || /^bytes=0-/i.test(range);
  let peeked;
  try { peeked = startsAtZero ? await peekStream(res.body) : { bytes: new Uint8Array(), body: res.body }; }
  catch { return hlsFallback() ?? plain("No media data received within 15 seconds", 502); }
  const protocol = detectMedia(peeked.bytes, ct, current.toString());
  const signatureProtocol = detectMedia(peeked.bytes);
  const htmlError = /^text\/html(?:\s*;|$)/i.test(ct) && signatureProtocol === "unknown";
  const invalidHls = protocol === "hls" && signatureProtocol !== "hls";
  if (htmlError || invalidHls) {
    await peeked.body?.cancel().catch(() => undefined);
    const fallback = hlsFallback();
    if (fallback) return fallback;
    return plain(htmlError ? "Stream origin returned HTML instead of media" : "Invalid HLS playlist response", 502);
  }
  if (protocol === "hls" || protocol === "dash") {
    const redirectTo = options.manifestRedirect?.[protocol];
    if (redirectTo) {
      await peeked.body?.cancel().catch(() => undefined);
      return new Response(null, { status: 302, headers: { ...CORS, Location: redirectTo, "Cache-Control": "no-store", "X-Media-Protocol": protocol } });
    }
    const manifest = await new Response(peeked.body).text();
    let body: string;
    try {
      if (protocol === "dash") {
        const { rewriteDash } = await import("./dash-manifest.server");
        body = await rewriteDash(manifest, current.toString(), prefix, scope);
      } else body = await rewritePlaylist(manifest, current.toString(), prefix, scope);
    } catch { return plain("Unsupported or invalid media manifest", 502); }
    return new Response(body, { headers: { ...CORS, "Content-Type": protocolMime[protocol], "Cache-Control": "private, max-age=3", "X-Media-Protocol": protocol } });
  }
  // A manifest-style entry link whose origin is actually raw MPEG-TS: send the player to the .ts link.
  if (protocol === "ts" && options.manifestRedirect?.ts && startsAtZero) {
    await peeked.body?.cancel().catch(() => undefined);
    return new Response(null, { status: 302, headers: { ...CORS, Location: options.manifestRedirect.ts, "Cache-Control": "no-store", "X-Media-Protocol": protocol } });
  }
  const genericType = !ct || /^(application\/octet-stream|binary\/octet-stream)(;|$)/i.test(ct);
  const inferred = protocol !== "unknown" ? protocolMime[protocol] : mediaContentType(current.toString());
  // Some IPTV origins label actual TS packets as text/html, video/mp4 or MPEGURL.
  // The verified transport signature takes priority for external provider players too.
  const out = new Headers({ ...CORS, "Content-Type": genericType || protocol === "ts" ? inferred : ct, "Cache-Control": "no-store", "X-Media-Protocol": protocol });
  for (const h of ["content-length", "content-range", "accept-ranges"]) { const v = res.headers.get(h); if (v) out.set(h, v); }
  return new Response(peeked.body, { status: res.status, headers: out });
}
