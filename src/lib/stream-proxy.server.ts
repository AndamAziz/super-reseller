// Header-injecting HLS proxy for channels that require Referer / User-Agent.
import type { M3UChannel } from "./m3u";
import { plain } from "./playlist-auth.server";
import { mediaContentType } from "./media";
import { detectMedia, protocolMime } from "./media-detection";
import { peekStream } from "./stream-peek";

export const needsProxy = (c: M3UChannel) => !!(c.referrer?.trim() || c.user_agent?.trim());

/** Stable per-device key: line + client IP + user-agent (Web Crypto — workerd-safe). */
async function clientInfo(request: Request, username: string): Promise<{ key: string; ua: string; ip: string }> {
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const ua = request.headers.get("user-agent") ?? "";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${username}|${ip}|${ua}`));
  const key = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
  return { key, ua, ip };
}

/**
 * Enforce a line's Max connections. Counts one active connection per device
 * (line + IP + user-agent) seen in the last 90 seconds. Returns null when the
 * stream may proceed, or a 429 response when the line is already at its limit.
 */
export async function checkStreamLimit(request: Request, line: { username: string; maxConnections: number }): Promise<Response | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row } = await supabaseAdmin.from("lines").select("id").eq("username", line.username).maybeSingle();
  if (!row) return null; // line vanished — authLine already validated it, fail open
  const { key, ua, ip } = await clientInfo(request, line.username);
  const { data, error } = await supabaseAdmin.rpc("check_stream_limit", {
    _line_id: row.id,
    _client_key: key,
    _max: line.maxConnections,
    _user_agent: ua,
    _ip: ip,
  });
  if (error) return null; // never break playback on a bookkeeping error
  if (data === false) return plain("Max connections reached for this line", 429);
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

export async function rewritePlaylist(text: string, from: string, prefix: string, scope: string): Promise<string> {
  const abs = async (uri: string) => {
    const full = new URL(uri.trim(), from).toString();
    return `${prefix}${prefix.includes("?") ? "&" : "?"}u=${b64u(full)}&s=${await signTarget(scope, full)}`;
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

/** Fetch target with the channel's headers; rewrite playlists, stream everything else. */
export async function proxyFetch(request: Request, target: URL, channel: M3UChannel, prefix: string, scope: string): Promise<Response> {
  const headers: Record<string, string> = { "User-Agent": channel.user_agent?.trim() || "Mozilla/5.0" };
  if (channel.referrer?.trim()) {
    headers["Referer"] = channel.referrer.trim();
    try { headers["Origin"] = new URL(channel.referrer.trim()).origin; } catch { /* ignore */ }
  }
  const range = request.headers.get("range");
  if (range) headers["Range"] = range;
  // Follow redirects manually so every hop is checked against private/local addresses.
  let res: Response | null = null;
  let current = target;
  try {
    for (let hop = 0; hop < 6; hop++) {
      if (isPrivateHost(current.hostname)) return plain("Forbidden target", 403);
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
      if (!res) return plain("Stream origin unreachable", 502);
      const loc = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
      if (!loc) break;
      current = new URL(loc, current);
      if (current.protocol !== "http:" && current.protocol !== "https:") return plain("Forbidden target", 403);
      res = null;
    }
  } catch {
    return plain("Stream origin unreachable", 502);
  }
  if (!res) return plain("Too many redirects", 502);
  if (!res.ok && res.status !== 206) return plain(`Stream origin error (HTTP ${res.status})`, 502);
  const ct = res.headers.get("content-type") ?? "";
  // Do not inspect nonzero byte ranges as if they start at a container header.
  const startsAtZero = !range || /^bytes=0-/i.test(range);
  let peeked;
  try { peeked = startsAtZero ? await peekStream(res.body) : { bytes: new Uint8Array(), body: res.body }; }
  catch { return plain("No media data received within 15 seconds", 502); }
  const protocol = detectMedia(peeked.bytes, ct, current.toString());
  if (protocol === "hls" || protocol === "dash") {
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
  const genericType = !ct || /^(application\/octet-stream|binary\/octet-stream)(;|$)/i.test(ct);
  const inferred = protocol !== "unknown" ? protocolMime[protocol] : mediaContentType(current.toString());
  // Some IPTV origins label actual TS packets as text/html, video/mp4 or MPEGURL.
  // The verified transport signature takes priority for external provider players too.
  const out = new Headers({ ...CORS, "Content-Type": genericType || protocol === "ts" ? inferred : ct, "Cache-Control": "no-store", "X-Media-Protocol": protocol });
  for (const h of ["content-length", "content-range", "accept-ranges"]) { const v = res.headers.get(h); if (v) out.set(h, v); }
  return new Response(peeked.body, { status: res.status, headers: out });
}
