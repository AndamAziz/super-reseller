// Catch-all for /api/public/playlist/* — some IPTV players append /get.php (or similar)
// to the playlist URL. Map any trailing path back to the playlist generator.
import { createFileRoute } from "@tanstack/react-router";
import { handlePlaylistRequest } from "@/lib/playlist-auth.server";

export const Route = createFileRoute("/api/public/playlist/$")({
  server: {
    handlers: {
      GET: async ({ request }) => handlePlaylistRequest(request),
    },
  },
});
