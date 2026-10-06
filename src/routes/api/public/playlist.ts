// Public M3U proxy: clients call /api/public/playlist?username=..&password=..
// Credentials and expiry are checked server-side; the real source URL is never revealed.
import { createFileRoute } from "@tanstack/react-router";
import { handlePlaylistRequest } from "@/lib/playlist-auth.server";

export const Route = createFileRoute("/api/public/playlist")({
  server: {
    handlers: {
      GET: async ({ request }) => handlePlaylistRequest(request),
    },
  },
});
