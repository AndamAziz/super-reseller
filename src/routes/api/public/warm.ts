// Keep-warm ping called by a scheduled job so the first IPTV app login after a quiet
// period does not pay worker + database cold-start cost. Read-only; returns no data.
import { createFileRoute } from "@tanstack/react-router";

async function warm() {
  const started = Date.now();
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await import("@/lib/playlist-auth.server");
    const { error } = await supabaseAdmin.from("lines").select("id", { head: true, count: "estimated" })
      .limit(1).abortSignal(AbortSignal.timeout(5_000));
    return Response.json({ ok: !error, ms: Date.now() - started }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false, ms: Date.now() - started }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export const Route = createFileRoute("/api/public/warm")({
  server: { handlers: { GET: warm, POST: warm } },
});
