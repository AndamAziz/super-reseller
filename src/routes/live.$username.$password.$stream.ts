// Xtream-style stream URL: /live/{user}/{pass}/{id}.ts → redirects to the channel's source stream.
import { createFileRoute } from "@tanstack/react-router";
import { authLine, loadChannels, plain } from "@/lib/playlist-auth.server";

export const Route = createFileRoute("/live/$username/$password/$stream")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const auth = await authLine(params.username, params.password);
        if (!auth.ok) return plain(auth.message, auth.status);
        const id = Number.parseInt(params.stream, 10);
        const loaded = await loadChannels();
        if (!loaded.ok) return plain(loaded.message, loaded.status);
        const ch = Number.isFinite(id) ? loaded.channels[id - 1] : undefined;
        if (!ch) return plain("Channel not found", 404);
        return new Response(null, { status: 302, headers: { Location: ch.url, "Cache-Control": "no-store" } });
      },
    },
  },
});
