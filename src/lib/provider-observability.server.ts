export async function recordProviderRequest(request: Request, requestType: string, started: number, status: number, timedOut = false) {
  const row = { request_type: requestType, duration_ms: Date.now() - started, status, timed_out: timedOut };
  // Never log URLs, usernames, passwords, IPs or source content.
  console.info('provider_request', JSON.stringify(row));
  const save = async () => {
    try {
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
      const { error } = await supabaseAdmin.from('provider_request_logs').insert(row).abortSignal(AbortSignal.timeout(500));
      if (error) console.warn('provider_log_write_failed');
    } catch { console.warn('provider_log_write_failed'); }
  };
  const background = (request as Request & { waitUntil?: (work: Promise<unknown>) => void }).waitUntil;
  if (background) background.call(request, save());
  // Best-effort: never make the app wait for diagnostics before it gets its answer.
  else void save();
}