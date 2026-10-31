// Xtream-style M3U download: /get.php?username=..&password=..&type=m3u_plus
import { createFileRoute } from "@tanstack/react-router";
import { handlePlaylistRequest } from "@/lib/playlist-auth.server";

export const Route = createFileRoute("/get.php")({
  server: {
    handlers: {
      GET: ({ request }) => handlePlaylistRequest(request),
    },
  },
});
