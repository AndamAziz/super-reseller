// Public Xtream-style M3U download: /api/public/get.php?username=..&password=..&type=m3u_plus
// Same as /get.php but under the public prefix so players can reach it on the hosted site.
import { createFileRoute } from "@tanstack/react-router";
import { handlePlaylistRequest } from "@/lib/playlist-auth.server";

export const Route = createFileRoute("/api/public/get.php")({
  server: {
    handlers: {
      GET: async ({ request }) => handlePlaylistRequest(request),
    },
  },
});
