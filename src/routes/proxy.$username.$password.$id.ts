// Segment/variant proxy for header-protected channels: /proxy/{user}/{pass}/{id}?u=<base64url>
import { createFileRoute } from "@tanstack/react-router";
import { authLine, loadChannels, plain } from "@/lib/playlist-auth.server";
import { allowedUrl, checkStreamLimit, proxyFetch, unb64u } from "@/lib/stream-proxy.server";

export const Route = createFileRoute("/proxy/$username/$password/$id")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Range" } }),
      GET: async ({ params, request }) => {
        const auth = await authLine(params.username, params.password);
        if (!auth.ok) return plain(auth.message, auth.status);
        const id = Number.parseInt(params.id, 10);
        const loaded = await loadChannels();
        if (!loaded.ok) return plain(loaded.message, loaded.status);
        const ch = Number.isFinite(id) ? loaded.channels[id - 1] : undefined;
        if (!ch) return plain("Channel not found", 404);
        const sp = new URL(request.url).searchParams;
        let raw: string;
        try { raw = unb64u(sp.get("u") ?? ""); } catch { return plain("Bad url", 400); }
        const scope = `${auth.username}:${id}`;
        const target = await allowedUrl(raw, sp.get("s") ?? "", scope);
        if (!target) return plain("Forbidden target", 403);
        const limited = await checkStreamLimit(request, auth);
        if (limited) return limited;
        const prefix = `${new URL(request.url).origin}/proxy/${encodeURIComponent(params.username)}/${encodeURIComponent(params.password)}/${id}`;
        return proxyFetch(request, target, ch, prefix, scope);
      },
    },
  },
});
