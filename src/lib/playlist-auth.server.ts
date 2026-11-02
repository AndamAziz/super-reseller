// Shared auth + source loading for the public playlist endpoints (M3U and Xtream-compatible).
import { buildM3U, parseM3U, type M3UChannel } from "./m3u";
import { createPlaylistCache } from "./playlist-cache";
import { playbackUrl } from "./media";
import { playlistVersion } from "./playlist-version";
import { providerTransientStatus, retryProviderRead } from "./provider-read";

export type AuthResult =
  | { ok: true; lineId: string; username: string; password: string; expiresAt: string; createdAt: string | null; maxConnections: number }
  | { ok: false; status: number; message: string };

export async function authLine(username: string, password: string): Promise<AuthResult> {
  if (!username || !password || username.length > 50 || password.length > 100) {
    return { ok: false, status: 401, message: "Invalid credentials" };
  }
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const result = await retryProviderRead(async () => await supabaseAdmin
      .from("lines")
      .select("id, username, password, expires_at, created_at, max_connections")
      .eq("username", username.trim())
      .abortSignal(AbortSignal.timeout(4_000))
      .maybeSingle(), r => Boolean(r.error) && providerTransientStatus(r.status));
    if (result.error) return { ok: false, status: 503, message: "Account service temporarily unavailable; retry shortly" };
    const line = result.data;
    if (!line || line.password !== password) return { ok: false, status: 401, message: "Invalid credentials" };
    if (new Date(line.expires_at).getTime() <= Date.now()) return { ok: false, status: 403, message: "Subscription expired" };
    return { ok: true, lineId: line.id, username: line.username, password: line.password, expiresAt: line.expires_at, createdAt: line.created_at ?? null, maxConnections: line.max_connections ?? 1 };
  } catch {
    return { ok: false, status: 503, message: "Account service temporarily unavailable; retry shortly" };
  }
}

/** Devices seen streaming on this line in the last 90 seconds (same window as check_stream_limit). */
export async function countActiveConnections(lineId: string): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - 90_000).toISOString();
  const result = await retryProviderRead(async () => await supabaseAdmin
    .from("active_connections")
    .select("client_key", { count: "exact", head: true })
    .eq("line_id", lineId)
    .gte("last_seen", since)
    .abortSignal(AbortSignal.timeout(4_000)), r => Boolean(r.error) && providerTransientStatus(r.status));
  if (result.error) throw new Error("Connection status temporarily unavailable");
  return result.count ?? 0;
}

export async function loadSourceText(): Promise<{ ok: true; text: string } | { ok: false; status: number; message: string }> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const settings = await retryProviderRead(async () => await supabaseAdmin.from("app_settings").select("value")
      .eq("key", "m3u_source_url").abortSignal(AbortSignal.timeout(4_000)).maybeSingle(),
      r => Boolean(r.error) && providerTransientStatus(r.status));
    if (settings.error) return { ok: false, status: 503, message: "Playlist configuration temporarily unavailable" };
    if (!settings.data?.value) return { ok: false, status: 503, message: "Playlist not configured" };
    const sourceUrl = settings.data.value;
    const result = await retryProviderRead(async () => {
      const source = new URL(sourceUrl);
      // Fresh GitHub cache key on each attempt; bounded deadline covers the complete catalog body.
      if (source.hostname === "raw.githubusercontent.com") source.searchParams.set("_refresh", String(Date.now()));
      const res = await fetch(source, { cache: "no-store", headers: { "Cache-Control": "no-cache" }, signal: AbortSignal.timeout(5_000) });
      if (!res.ok) {
        await res.body?.cancel();
        return { status: res.status, text: null };
      }
      return { status: res.status, text: await res.text() };
    }, r => providerTransientStatus(r.status));
    if (result.text === null) return { ok: false, status: 502, message: `Playlist source unavailable (HTTP ${result.status})` };
    return { ok: true, text: result.text };
  } catch {
    return { ok: false, status: 502, message: "Playlist source unreachable" };
  }
}

export type Episode = M3UChannel & { id: number; season: number; episode: number };
export type Series = { id: number; title: string; category: string; cover: string | null; episodes: Episode[] };
export type Catalog = { channels: M3UChannel[]; live: M3UChannel[]; movies: M3UChannel[]; series: Series[]; episodes: Episode[]; version?: string };

export function buildCatalog(all: M3UChannel[]): Catalog {
  const live: M3UChannel[] = [], movies: M3UChannel[] = [], episodes: Episode[] = [];
  const byTitle = new Map<string, Series>();
  for (const c of all) {
    if (c.type === "movie") movies.push(c);
    else if (c.type === "series") {
      const m = /^(.*?)\s*-\s*S(\d+)E(\d+)/i.exec(c.name);
      const title = (m?.[1] ?? c.name).trim();
      const cat = c.group_title ?? "Uncategorized";
      let s = byTitle.get(title);
      if (!s) { s = { id: byTitle.size + 1, title, category: cat, cover: c.logo, episodes: [] }; byTitle.set(title, s); }
      const ep: Episode = { ...c, id: episodes.length + 1, season: Number(m?.[2] ?? 1), episode: Number(m?.[3] ?? s.episodes.length + 1) };
      episodes.push(ep); s.episodes.push(ep);
    } else live.push(c);
  }
  return { channels: all, live, movies, series: [...byTitle.values()], episodes };
}

const readCatalog = createPlaylistCache(async () => {
  const src = await loadSourceText();
  if (!src.ok) throw new Error(src.message);
  const channels = parseM3U(src.text);
  if (!channels.length) throw new Error("Playlist source contains no playable entries");
  return { ...buildCatalog(channels), version: await playlistVersion(src.text) };
});

export async function loadCatalog(force = false): Promise<{ ok: true; catalog: Catalog } | { ok: false; status: number; message: string }> {
  try { return { ok: true, catalog: await readCatalog(force) }; }
  catch (error) { return { ok: false, status: 502, message: error instanceof Error ? error.message : "Playlist source unreachable" }; }
}

/** Live channels only (series/movies are excluded). */
export async function loadChannels(): Promise<{ ok: true; channels: M3UChannel[] } | { ok: false; status: number; message: string }> {
  const r = await loadCatalog();
  return r.ok ? { ok: true, channels: r.catalog.live } : r;
}

// Shared M3U proxy handler: validates username/password/expiry and streams the source playlist.
// Used by /api/public/playlist and its catch-all (players that append /get.php to the URL).
export async function handlePlaylistRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const auth = await authLine(url.searchParams.get("username") ?? "", url.searchParams.get("password") ?? "");
  if (!auth.ok) return plain(auth.message, auth.status);
  const loaded = await loadCatalog(url.searchParams.get("refresh") === "1");
  if (!loaded.ok) return plain(loaded.message, loaded.status);
  // Rewrite every stream URL through this app so auth, max-connections and referer rules apply.
  const origin = url.origin;
  const { live, movies, episodes } = loaded.catalog;
  const rewritten: M3UChannel[] = [
    ...live.map((c, i) => ({ ...c, url: playbackUrl(origin, "live", auth.username, auth.password, i + 1, c.url, c) })),
    ...movies.map((m, i) => ({ ...m, url: playbackUrl(origin, "movie", auth.username, auth.password, i + 1, m.url, m) })),
    ...episodes.map((e) => ({ ...e, url: playbackUrl(origin, "series", auth.username, auth.password, e.id, e.url, e) })),
  ];
  return new Response(buildM3U(rewritten), {
    headers: {
      "Content-Type": "audio/x-mpegurl; charset=utf-8",
      "Content-Disposition": `inline; filename="${auth.username}.m3u"`,
      "Cache-Control": "no-store",
    },
  });
}

export const plain = (body: string, status: number) =>
  new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" },
  });
