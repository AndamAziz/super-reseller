// Keep-warm ping called by a scheduled job so the first IPTV app login after a quiet
// period does not pay worker + database cold-start cost. Read-only; returns no data.
import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';
import { recordProviderRequest } from '@/lib/provider-observability.server';

async function warm({ request }: { request: Request }) {
  const started = Date.now();
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("lines").select("id", { head: true, count: "estimated" })
      .limit(1).abortSignal(AbortSignal.timeout(5_000));
    const response = Response.json({ ok: !error, ms: Date.now() - started }, { headers: { "Cache-Control": "no-store" } });
    await recordProviderRequest(request, 'health', started, response.status);
    return response;
  } catch {
    return Response.json({ ok: false, ms: Date.now() - started }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export const Route = createFileRoute("/api/public/warm")({
  server: { handlers: { GET: warm, POST: async ({ request }) => {
    const failure = await authenticateCronRequest(request);
    if (failure) return failure;
    const response = await warm({ request });
    const work = async () => {
      const { refreshCatalog } = await import('@/lib/playlist-auth.server');
      try { await refreshCatalog(); } catch { console.warn('provider_warm_catalog_unavailable'); }
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
      await supabaseAdmin.rpc('prune_provider_request_logs').abortSignal(AbortSignal.timeout(1500));
    };
    const background = (request as Request & { waitUntil?: (work: Promise<unknown>) => void }).waitUntil;
    if (background) background.call(request, work());
    else await work();
    return response;
  } } },
});
