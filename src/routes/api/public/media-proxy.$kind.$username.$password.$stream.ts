import { createFileRoute } from "@tanstack/react-router";
import { handleMediaPlayback, playbackOptions } from "@/lib/media-playback.server";
import { plain } from "@/lib/playlist-auth.server";
export const Route = createFileRoute("/api/public/media-proxy/$kind/$username/$password/$stream")({
  server: { handlers: {
    OPTIONS: playbackOptions,
    GET: ({ request, params }) => {
      if (params.kind !== "live" && params.kind !== "movie" && params.kind !== "series") return plain("Invalid stream type", 400);
      return handleMediaPlayback(request, params.username, params.password, params.stream, params.kind, true);
    },
  } },
});