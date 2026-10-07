// Xtream-style stream URL: /movie/{user}/{pass}/{id}.ts → redirects to the channel's source stream.
import { createFileRoute } from "@tanstack/react-router";
import { authLine, loadCatalog, plain } from "@/lib/playlist-auth.server";

export const Route = createFileRoute("/movie/$username/$password/$stream")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const auth = await authLine(params.username, params.password);
        if (!auth.ok) return plain(auth.message, auth.status);
        const id = Number.parseInt(params.stream, 10);
        const loaded = await loadCatalog();
        if (!loaded.ok) return plain(loaded.message, loaded.status);
        const ch = Number.isFinite(id) ? loaded.catalog.movies[id - 1] : undefined;
        if (!ch) return plain("Not found", 404);
        return new Response(null, { status: 302, headers: { Location: ch.url, "Cache-Control": "no-store" } });
      },
    },
  },
});
