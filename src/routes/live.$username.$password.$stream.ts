// Xtream-style stream URL without the /api/public prefix: /live/{user}/{pass}/{id}.{ext}
// Uses the same shared playback handler as every other entry link, so auth, Max connections,
// channel identity and .ts/.m3u8 format mirroring behave identically for all providers.
import { createFileRoute } from "@tanstack/react-router";
import { handleMediaPlayback, playbackOptions } from "@/lib/media-playback.server";

export const Route = createFileRoute("/live/$username/$password/$stream")({
  server: {
    handlers: {
      OPTIONS: playbackOptions,
      GET: ({ params, request }) => handleMediaPlayback(request, params.username, params.password, params.stream, "live"),
    },
  },
});
