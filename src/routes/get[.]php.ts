// Xtream-style M3U download: /get.php?username=..&password=..&type=m3u_plus
import { createFileRoute } from "@tanstack/react-router";
import { authLine, loadSourceText, plain } from "@/lib/playlist-auth.server";

export const Route = createFileRoute("/get.php")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const auth = await authLine(url.searchParams.get("username") ?? "", url.searchParams.get("password") ?? "");
        if (!auth.ok) return plain(auth.message, auth.status);
        const src = await loadSourceText();
        if (!src.ok) return plain(src.message, src.status);
        return new Response(src.text, {
          headers: {
            "Content-Type": "audio/x-mpegurl; charset=utf-8",
            "Content-Disposition": `inline; filename="${auth.username}.m3u"`,
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
