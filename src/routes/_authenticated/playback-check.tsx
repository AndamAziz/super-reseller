import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { useMe } from "@/hooks/use-me";

const Harness = lazy(() => import("@/components/playback-check-harness"));
export const Route = createFileRoute("/_authenticated/playback-check")({
  head: () => ({ meta: [
    { title: "Playback verification — Kurdistan IPTV" },
    { name: "description", content: "Authorized audio and video playback verification for Kurdistan IPTV." },
    { property: "og:title", content: "Playback verification — Kurdistan IPTV" },
    { property: "og:description", content: "Authorized audio and video playback verification for Kurdistan IPTV." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex,nofollow" },
  ] }),
  component: () => {
    const { data: me } = useMe();
    if (me?.role !== "admin") return <p>Admin access required.</p>;
    return <ClientOnly><Suspense fallback={null}><Harness /></Suspense></ClientOnly>;
  },
});