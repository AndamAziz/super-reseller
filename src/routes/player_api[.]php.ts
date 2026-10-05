// Xtream Codes-compatible API so IPTV apps can add this server as an "Xtream" provider.
// Backed by the protected M3U source; live channels only (no movies/series in an M3U).
import { createFileRoute } from "@tanstack/react-router";
import { authLine, json, loadChannels } from "@/lib/playlist-auth.server";

export const Route = createFileRoute("/player_api.php")({
  server: {
    handlers: {
      GET: async ({ request }) => handle(request),
      POST: async ({ request }) => handle(request),
    },
  },
});

async function handle(request: Request) {
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
        active_cons: "0",
        created_at: String(Math.floor(new Date(auth.createdAt ?? Date.now()).getTime() / 1000)),
        max_connections: "1",
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

  if (["get_vod_categories", "get_series_categories", "get_vod_streams", "get_series"].includes(action)) return json([]);

  const loaded = await loadChannels();
  if (!loaded.ok) return json({ error: loaded.message }, loaded.status);
  const groups = [...new Set(loaded.channels.map((c) => c.group_title ?? "Uncategorized"))];
  const catId = (g: string | null) => String(groups.indexOf(g ?? "Uncategorized") + 1);

  if (action === "get_live_categories") {
    return json(groups.map((g, i) => ({ category_id: String(i + 1), category_name: g, parent_id: 0 })));
  }
  if (action === "get_live_streams") {
    const filter = params.get("category_id");
    return json(
      loaded.channels
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
          direct_source: c.url,
          tv_archive_duration: 0,
        }))
        .filter((s) => !filter || s.category_id === filter),
    );
  }
  return json([]);
}
