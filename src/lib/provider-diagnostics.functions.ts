import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

export const getProviderDiagnostics = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: admin } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' });
    if (!admin) throw new Error('Access denied');
    const since = new Date(Date.now() - 86400_000).toISOString();
    const [slowest, timeouts, total] = await Promise.all([
      context.supabase.from('provider_request_logs').select('request_type,duration_ms,status,timed_out,created_at').gte('created_at', since).order('duration_ms', { ascending: false }).limit(10),
      context.supabase.from('provider_request_logs').select('id', { count: 'exact', head: true }).gte('created_at', since).eq('timed_out', true),
      context.supabase.from('provider_request_logs').select('id', { count: 'exact', head: true }).gte('created_at', since),
    ]);
    if (slowest.error || timeouts.error || total.error) throw new Error('Diagnostics temporarily unavailable');
    return { since, slowest: slowest.data, timeouts: timeouts.count, total: total.count };
  });