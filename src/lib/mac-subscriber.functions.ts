import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { accountTypeSchema, generateMac, macSchema } from './mac-portal';
import { maxConnectionsSchema } from './connection-limit';

const identity = z.object({ accountType: accountTypeSchema, mac: z.string().max(50).nullable() }).superRefine((v, ctx) => {
  if (v.accountType !== 'xtream' && !macSchema.safeParse(v.mac).success) ctx.addIssue({ code: 'custom', message: 'MAC must be 00:1A:79:XX:XX:XX', path: ['mac'] });
});
const credentials = z.object({ username: z.string().trim().min(3).max(50).regex(/^[\w.-]+$/), password: z.string().min(4).max(100) });
export const createMacSubscriber = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(data => credentials.extend({ months: z.number().int().min(0).max(24), customHost: z.string().trim().max(200).optional(), customer: z.string().trim().min(3).max(100).optional() }).and(identity).parse(data))
  .handler(async ({ data, context }) => {
    if (data.months === 0 && !data.customer) throw new Error('Customer phone or ID required for a test');
    const { data: lineId, error } = await context.supabase.rpc('create_subscriber', { _username: data.username, _password: data.password, _months: data.months, _account_type: data.accountType, ...(data.accountType === 'xtream' ? {} : { _mac: macSchema.parse(data.mac) }), _custom_host: data.customHost ?? '', ...(data.customer ? { _customer: data.customer } : {}) });
    if (error) throw new Error(error.message.includes('mac_address') ? 'MAC address already assigned' : error.message);
    return { ok: true as const, lineId };
  });
export const updateMacSubscriber = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(data => z.object({ lineId: z.string().uuid(), password: z.string().min(4).max(100), customHost: z.string().trim().max(200).nullable(), expiresAt: z.string().datetime().nullable(), maxConnections: maxConnectionsSchema, disabled: z.boolean() }).and(identity).parse(data))
  .handler(async ({ data, context }) => {
    const { data: charge, error } = await context.supabase.rpc('update_subscriber', { _line_id: data.lineId, _password: data.password, _custom_host: data.customHost ?? '', _max_connections: data.maxConnections, _account_type: data.accountType, _mac: data.accountType === 'xtream' ? '' : macSchema.parse(data.mac), _disabled: data.disabled, ...(data.expiresAt ? { _expires_at: data.expiresAt } : {}) });
    if (error) throw new Error(error.message.includes('mac_address') ? 'MAC address already assigned' : error.message);
    return { ok: true as const, creditsCharged: charge ?? 0 };
  });
export const generateSubscriberMac = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles, error } = await context.supabase.from('user_roles').select('role').eq('user_id', context.userId);
    if (error || !roles?.some(r => r.role === 'admin' || r.role === 'reseller')) throw new Error('Not allowed');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    for (let i = 0; i < 10; i++) {
      const mac = generateMac();
      const { data, error: lookupError } = await supabaseAdmin.from('lines').select('id').eq('mac_address', mac).maybeSingle();
      if (lookupError) throw new Error('MAC generation temporarily unavailable');
      if (!data) return { mac };
    }
    throw new Error('Please try generating again');
  });