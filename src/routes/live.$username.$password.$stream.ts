// Xtream-style stream URL: /live/{user}/{pass}/{id}.m3u8
// Every channel is served through our proxy so Max connections is enforced for all lines.
// Channels with a stored Referer/User-Agent also get those headers injected on origin fetches.
import { createFileRoute } from "@tanstack/react-router";
import { authLine, loadChannels, plain } from "@/lib/playlist-auth.server";
import { checkStreamLimit, proxyFetch } from "@/lib/stream-proxy.server";

export const Route = createFileRoute("/live/$username/$password/$stream")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const auth = await authLine(params.username, params.password);
        if (!auth.ok) return plain(auth.message, auth.status);
        const id = Number.parseInt(params.stream, 10);
        const loaded = await loadChannels();
        if (!loaded.ok) return plain(loaded.message, loaded.status);
        const ch = Number.isFinite(id) ? loaded.channels[id - 1] : undefined;
        if (!ch) return plain("Channel not found", 404);
        const limited = await checkStreamLimit(request, auth);
        if (limited) return limited;
        const prefix = `${new URL(request.url).origin}/proxy/${encodeURIComponent(params.username)}/${encodeURIComponent(params.password)}/${id}`;
        return proxyFetch(request, new URL(ch.url), ch, prefix);
      },
    },
  },
});
