// Header-injecting HLS proxy for channels that require Referer / User-Agent.
import type { M3UChannel } from "./m3u";
import { plain } from "./playlist-auth.server";

export const needsProxy = (c: M3UChannel) => !!(c.referrer?.trim() || c.user_agent?.trim());

/** Stable per-device key: line + client IP + user-agent (Web Crypto — workerd-safe). */
async function clientKey(request: Request, username: string): Promise<string> {
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const ua = request.headers.get("user-agent") ?? "";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${username}|${ip}|${ua}`));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
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
  const key = await clientKey(request, line.username);
  const { data, error } = await supabaseAdmin.rpc("check_stream_limit", {
    _line_id: row.id,
    _client_key: key,
    _max: line.maxConnections,
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

/** Allowed: http(s), public host, same registrable base domain as the channel origin. */
export function allowedUrl(target: string, channel: M3UChannel): URL | null {
  let u: URL, o: URL;
  try { u = new URL(target); o = new URL(channel.url); } catch { return null; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (isPrivateHost(u.hostname)) return null;
  const base = (h: string) => h.split(".").slice(-2).join(".");
  return base(u.hostname) === base(o.hostname) ? u : null;
}

function rewrite(text: string, from: string, prefix: string) {
  const abs = (uri: string) => `${prefix}?u=${b64u(new URL(uri, from).toString())}`;
  return text.split(/\r?\n/).map((line) => {
    const t = line.trim();
    if (!t) return line;
    if (t.startsWith("#")) return line.replace(/URI="([^"]+)"/g, (_, uri: string) => `URI="${abs(uri)}"`);
    return abs(t);
  }).join("\n");
}

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Expose-Headers": "Content-Length, Content-Range" };

/** Fetch target with the channel's headers; rewrite playlists, stream everything else. */
export async function proxyFetch(request: Request, target: URL, channel: M3UChannel, prefix: string): Promise<Response> {
  const headers: Record<string, string> = { "User-Agent": channel.user_agent?.trim() || "Mozilla/5.0" };
  if (channel.referrer?.trim()) {
    headers["Referer"] = channel.referrer.trim();
    try { headers["Origin"] = new URL(channel.referrer.trim()).origin; } catch { /* ignore */ }
  }
  const range = request.headers.get("range");
  if (range) headers["Range"] = range;
  let res: Response;
  try {
    res = await fetch(target, { headers, redirect: "follow", signal: AbortSignal.timeout(15000) });
  } catch {
    return plain("Stream origin unreachable", 502);
  }
  if (!res.ok && res.status !== 206) return plain(`Stream origin error (HTTP ${res.status})`, 502);
  const ct = res.headers.get("content-type") ?? "";
  const isPlaylist = /mpegurl/i.test(ct) || /\.m3u8?($|\?)/i.test(new URL(res.url || target.toString()).pathname);
  if (isPlaylist) {
    const body = rewrite(await res.text(), res.url || target.toString(), prefix);
    return new Response(body, { headers: { ...CORS, "Content-Type": "application/vnd.apple.mpegurl", "Cache-Control": "public, max-age=3" } });
  }
  const out = new Headers({ ...CORS, "Content-Type": ct || "video/mp2t", "Cache-Control": "public, max-age=60" });
  for (const h of ["content-length", "content-range", "accept-ranges"]) { const v = res.headers.get(h); if (v) out.set(h, v); }
  return new Response(res.body, { status: res.status, headers: out });
}
