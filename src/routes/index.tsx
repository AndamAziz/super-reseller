import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kurdistan IPTV" },
      { name: "description", content: "Reseller and admin control panel for subscription lines and playlists." },
      { property: "og:title", content: "Kurdistan IPTV" },
      { property: "og:description", content: "Reseller and admin control panel for subscription lines and playlists." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
