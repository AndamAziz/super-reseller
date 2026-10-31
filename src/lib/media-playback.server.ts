import { authLine, loadCatalog, plain } from "./playlist-auth.server";
import { checkStreamLimit, proxyFetch, allowedUrl, unb64u } from "./stream-proxy.server";
import type { MediaKind } from "./media";

export async function handleMediaPlayback(request: Request, username: string, password: string, stream: string, kind: MediaKind, segment = false): Promise<Response> {
  const auth = await authLine(username, password);
  if (!auth.ok) return plain(auth.message, auth.status);
  if (!/^\d+(?:\.[a-z0-9]+)?$/i.test(stream)) return plain("Invalid stream", 400);
  const id = Number.parseInt(stream, 10);
  const loaded = await loadCatalog();
  if (!loaded.ok) return plain(loaded.message, loaded.status);
  const items = kind === "live" ? loaded.catalog.live : kind === "movie" ? loaded.catalog.movies : loaded.catalog.episodes;
  const channel = items[id - 1];
  if (!channel) return plain("Stream not found", 404);
  const scope = kind === "live" ? `${auth.username}:${id}` : `${auth.username}:${kind}:${id}`;
  let target: URL;
  if (segment) {
    const params = new URL(request.url).searchParams;
    let raw: string;
    try { raw = unb64u(params.get("u") ?? ""); } catch { return plain("Bad url", 400); }
    const allowed = await allowedUrl(raw, params.get("s") ?? "", scope);
    if (!allowed) return plain("Forbidden target", 403);
    target = allowed;
  } else {
    try { target = new URL(channel.url); } catch { return plain("Invalid source URL", 502); }
  }
  const limited = await checkStreamLimit(request, auth);
  if (limited) return limited;
  const prefix = `${new URL(request.url).origin}/api/public/media-proxy/${kind}/${encodeURIComponent(auth.username)}/${encodeURIComponent(auth.password)}/${id}`;
  return proxyFetch(request, target, channel, prefix, scope);
}

export const playbackOptions = () => new Response(null, { status: 204, headers: {
  "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Range", "Access-Control-Allow-Methods": "GET, OPTIONS",
} });