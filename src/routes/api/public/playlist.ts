// Public M3U proxy: clients call /api/public/playlist?username=..&password=..
// Credentials and expiry are checked server-side; the real source URL is never revealed.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const q = z.object({
  username: z.string().trim().min(1).max(50),
  password: z.string().min(1).max(100),
});

const text = (body: string, status: number) =>
  new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

export const Route = createFileRoute("/api/public/playlist")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const parsed = q.safeParse({
          username: url.searchParams.get("username") ?? "",
          password: url.searchParams.get("password") ?? "",
        });
        if (!parsed.success) return text("Invalid credentials", 401);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: line } = await supabaseAdmin
          .from("lines")
          .select("password, expires_at")
          .eq("username", parsed.data.username)
          .maybeSingle();
        if (!line || line.password !== parsed.data.password) return text("Invalid credentials", 401);
        if (new Date(line.expires_at).getTime() <= Date.now()) return text("Subscription expired", 403);

        const { data: setting } = await supabaseAdmin
          .from("app_settings")
          .select("value")
          .eq("key", "m3u_source_url")
          .maybeSingle();
        if (!setting?.value) return text("Playlist not configured", 503);

        try {
          const src = await fetch(setting.value, { signal: AbortSignal.timeout(20000) });
          if (!src.ok || !src.body) return text("Playlist temporarily unavailable", 502);
          return new Response(src.body, {
            status: 200,
            headers: {
              "Content-Type": "audio/x-mpegurl; charset=utf-8",
              "Content-Disposition": `inline; filename="${parsed.data.username}.m3u"`,
              "Cache-Control": "no-store",
            },
          });
        } catch {
          return text("Playlist temporarily unavailable", 502);
        }
      },
    },
  },
});
