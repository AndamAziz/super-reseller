// Public Xtream Codes-compatible API: /api/public/player_api.php
// Same logic as /player_api.php, but under the public prefix so IPTV players
// can reach it on the hosted site without hitting the access wall.
// In the player, enter the host as: https://<your-site>/api/public
import { createFileRoute } from "@tanstack/react-router";
import { handleXtreamRequest } from "../../player_api[.]php";

export const Route = createFileRoute("/api/public/player_api.php")({
  server: {
    handlers: {
      GET: async ({ request }) => handleXtreamRequest(request),
      POST: async ({ request }) => handleXtreamRequest(request),
    },
  },
});
