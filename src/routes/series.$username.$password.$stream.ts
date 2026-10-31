// Xtream-style stream URL: /series/{user}/{pass}/{id}.ts → redirects to the channel's source stream.
import { createFileRoute } from "@tanstack/react-router";
import { handleMediaPlayback, playbackOptions } from "@/lib/media-playback.server";

export const Route = createFileRoute("/series/$username/$password/$stream")({
  server: {
    handlers: {
      OPTIONS: playbackOptions,
      GET: ({ params, request }) => handleMediaPlayback(request, params.username, params.password, params.stream, "series"),
    },
  },
});
