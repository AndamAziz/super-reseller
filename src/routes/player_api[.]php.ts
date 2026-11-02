// Xtream Codes-compatible API so IPTV apps can add this server as an "Xtream" provider.
// Backed by the protected shared M3U source, including movies and series.
import { createFileRoute } from "@tanstack/react-router";
import { authLine, countActiveConnections, json, loadCatalog } from "@/lib/playlist-auth.server";
import { needsProxy } from "@/lib/stream-proxy.server";
import { mediaExtension, playbackUrl } from "@/lib/media";
import { providerMetadata } from '@/lib/provider-metadata';

export const Route = createFileRoute("/player_api.php")({
  server: {
    handlers: {
      GET: async ({ request }) => handleXtreamRequest(request),
      POST: async ({ request }) => handleXtreamRequest(request),
    },
  },
});

export async function handleXtreamRequest(request: Request) {
  const url = new URL(request.url);
  const params = new URLSearchParams(url.search);
  if (request.method === "POST") {
    try {
      const body = new URLSearchParams(await request.text());
      body.forEach((v, k) => params.set(k, v));
    } catch { /* ignore */ }
  }
  const username = params.get("username") ?? "";
  const password = params.get("password") ?? "";
  const action = params.get("action") ?? "";

  const auth = await authLine(username, password);
  if (!auth.ok) {
    // Xtream clients expect 200 + auth:0 rather than a bare HTTP error.
    return json({ user_info: { auth: 0, status: auth.status === 403 ? "Expired" : "Disabled", message: auth.message } });
  }

  if (!action) {
    const exp = Math.floor(new Date(auth.expiresAt).getTime() / 1000);
    return json({
      user_info: {
        username: auth.username,
        password: auth.password,
        message: "",
        auth: 1,
        status: "Active",
        exp_date: String(exp),
        is_trial: "0",
        active_cons: String(await countActiveConnections(auth.lineId)),
        created_at: String(Math.floor(new Date(auth.createdAt ?? Date.now()).getTime() / 1000)),
        max_connections: String(auth.maxConnections),
        allowed_output_formats: ["m3u8", "ts"],
      },
      server_info: {
        url: url.hostname,
        port: url.port || (url.protocol === "https:" ? "443" : "80"),
        https_port: "443",
        server_protocol: url.protocol.replace(":", ""),
        timezone: "UTC",
        timestamp_now: Math.floor(Date.now() / 1000),
        time_now: new Date().toISOString().replace("T", " ").slice(0, 19),
      },
    });
  }

  const loaded = await loadCatalog(params.get("refresh") === "1");
  if (!loaded.ok) return json({ error: loaded.message }, loaded.status);
  const { live, movies, series } = loaded.catalog;
  const base = `${url.origin}`;
  const cats = (items: { group_title?: string | null; category?: string }[]) =>
    [...new Set(items.map((c) => c.category ?? c.group_title ?? "Uncategorized"))];
  const groups = cats(live);
  const catId = (g: string | null) => String(groups.indexOf(g ?? "Uncategorized") + 1);
  const filter = params.get("category_id");

  if (action === "get_vod_categories") {
    return json(cats(movies).map((g, i) => ({ category_id: String(i + 1), category_name: g, parent_id: 0 })));
  }
  if (action === "get_vod_streams") {
    const vc = cats(movies);
    return json(movies.map((m, i) => ({
      num: i + 1, name: m.name, stream_type: "movie", stream_id: i + 1, stream_icon: m.logo ?? "",
      ...providerMetadata(m), added: "0", category_id: String(vc.indexOf(m.group_title ?? "Uncategorized") + 1),
      container_extension: mediaExtension(m.url), custom_sid: "", direct_source: playbackUrl(base, "movie", auth.username, auth.password, i + 1, m.url, m),
    })).filter((s) => !filter || s.category_id === filter));
  }
  if (action === "get_vod_info") {
    const id = Number(params.get("vod_id"));
    const m = Number.isInteger(id) && id > 0 ? movies[id - 1] : undefined;
    if (!m) return json({ info: {}, movie_data: {} });
    const metadata = providerMetadata(m);
    return json({
      info: { ...metadata, name: m.name, movie_image: m.logo ?? "", cover_big: m.logo ?? "", releasedate: metadata.releaseDate },
      movie_data: { stream_id: id, name: m.name, stream_type: "movie", added: "0", category_id: String(cats(movies).indexOf(m.group_title ?? "Uncategorized") + 1),
        container_extension: mediaExtension(m.url), custom_sid: "", direct_source: playbackUrl(base, "movie", auth.username, auth.password, id, m.url, m) },
    });
  }
  const sc = cats(series);
  if (action === "get_series_categories") {
    return json(sc.map((g, i) => ({ category_id: String(i + 1), category_name: g, parent_id: 0 })));
  }
  if (action === "get_series") {
    return json(series.map((s, i) => ({
      num: i + 1, name: s.title, series_id: s.id, cover: s.cover ?? "", plot: "", cast: "", director: "", genre: "",
      releaseDate: "", last_modified: "0", rating: "", rating_5based: 0, backdrop_path: [], youtube_trailer: "",
      ...(s.episodes[0] ? providerMetadata(s.episodes[0]) : {}),
      episode_run_time: "", category_id: String(sc.indexOf(s.category) + 1),
    })).filter((s) => !filter || s.category_id === filter));
  }
  if (action === "get_series_info") {
    const s = series.find((x) => x.id === Number(params.get("series_id")));
    if (!s) return json({ seasons: [], info: {}, episodes: {} });
    const episodes: Record<string, unknown[]> = {};
    for (const e of s.episodes) {
      (episodes[String(e.season)] ??= []).push({
        id: String(e.id), episode_num: e.episode, title: e.name, container_extension: mediaExtension(e.url),
        info: { ...providerMetadata(e), movie_image: e.logo ?? s.cover ?? "" }, season: e.season, custom_sid: "", added: "0",
        direct_source: playbackUrl(base, "series", auth.username, auth.password, e.id, e.url, e),
      });
    }
    return json({
      seasons: Object.keys(episodes).map((n) => ({ season_number: Number(n), name: `Season ${n}`, episode_count: episodes[n]?.length ?? 0, cover: s.cover ?? "" })),
      info: { name: s.title, cover: s.cover ?? "", plot: "", cast: "", director: "", genre: "", releaseDate: "", rating: "", ...(s.episodes[0] ? providerMetadata(s.episodes[0]) : {}), category_id: String(sc.indexOf(s.category) + 1) },
      episodes,
    });
  }

  if (action === "get_live_categories") {
    return json(groups.map((g, i) => ({ category_id: String(i + 1), category_name: g, parent_id: 0 })));
  }
  if (action === "get_live_streams") {
    return json(
      live
        .map((c, i) => ({
          num: i + 1,
          name: c.name,
          stream_type: "live",
          stream_id: i + 1,
          stream_icon: c.logo ?? "",
          epg_channel_id: null,
          added: "0",
          category_id: catId(c.group_title),
          custom_sid: "",
          tv_archive: 0,
          container_extension: mediaExtension(c.url),
          direct_source: playbackUrl(base, "live", auth.username, auth.password, i + 1, c.url, c),
          requires_referer: needsProxy(c),
          tv_archive_duration: 0,
        }))
        .filter((s) => !filter || s.category_id === filter),
    );
  }
  return json([]);
}
