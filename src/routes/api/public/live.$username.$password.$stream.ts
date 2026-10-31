import { createFileRoute } from "@tanstack/react-router";
import { handleMediaPlayback, playbackOptions } from "@/lib/media-playback.server";
export const Route = createFileRoute("/api/public/live/$username/$password/$stream")({
  server: { handlers: {
    OPTIONS: playbackOptions,
    GET: ({ request, params }) => handleMediaPlayback(request, params.username, params.password, params.stream, "live"),
  } },
});