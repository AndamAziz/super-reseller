// Server functions for managing subscription lines.
// Credit deduction and expiry stay in the DB functions (create_line / renew_line);
// these wrappers add validation, auth, and the custom-host field.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const lineSchema = z.object({
  username: z.string().trim().min(3).max(50).regex(/^[\w.-]+$/),
  password: z.string().min(4).max(100),
  months: z.number().int().min(1).max(24),
  customHost: z.string().trim().max(200).optional(),
});

const renewSchema = z.object({
  lineId: z.string().uuid(),
  months: z.number().int().min(1).max(24),
});

const deleteSchema = z.object({
  lineId: z.string().uuid(),
});

export const createLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => lineSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: line, error } = await context.supabase.rpc("create_line", {
      _username: data.username,
      _password: data.password,
      _months: data.months,
    });
    if (error) {
      throw new Error(error.message.includes("duplicate") ? "Username already taken" : error.message);
    }
    if (line && data.customHost) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("lines").update({ custom_host: data.customHost }).eq("id", line.id);
    }
    return { ok: true as const };
  });

const testLineSchema = z.object({
  username: z.string().trim().min(3).max(50).regex(/^[\w.-]+$/),
  password: z.string().min(4).max(100),
  customer: z.string().trim().min(3).max(100),
});

/** Free 24-hour test line — one per customer, no credits (enforced in the DB function). */
export const createTestLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => testLineSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("create_test_line", {
      _username: data.username,
      _password: data.password,
      _customer: data.customer,
    });
    if (error) {
      throw new Error(error.message.includes("duplicate") ? "Username already taken" : error.message);
    }
    return { ok: true as const };
  });

export const checkTestUsed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ customer: z.string().trim().min(3).max(100) }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: r } = await context.supabase.rpc("test_used", { _customer: data.customer });
    const v = r as { used?: boolean; at?: string } | null;
    return { used: !!v?.used, at: v?.at ?? null };
  });

export const renewLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => renewSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("renew_line", {
      _line_id: data.lineId,
      _months: data.months,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

const updateSchema = z.object({
  lineId: z.string().uuid(),
  password: z.string().min(4).max(100),
  customHost: z.string().trim().max(200).nullable(),
  expiresAt: z.string().datetime().nullable(),
  maxConnections: z.number().int().min(1).max(100).default(1),
});

/** Edit password / custom host (owner or admin). Only admins may set the expiry directly — resellers extend via credits. */
export const updateLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => updateSchema.parse(data))
  .handler(async ({ data, context }) => {
    // RLS: caller can only see their own lines (or all, if admin).
    const { data: line } = await context.supabase.from("lines").select("id").eq("id", data.lineId).maybeSingle();
    if (!line) throw new Error("Line not found");
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    const patch: { password: string; custom_host: string | null; max_connections: number; expires_at?: string } = {
      password: data.password,
      custom_host: data.customHost || null,
      max_connections: data.maxConnections,
    };
    if (data.expiresAt) {
      if (!isAdmin) throw new Error("Only admins can change the expiry date directly — use Renew");
      patch.expires_at = data.expiresAt;
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("lines").update(patch).eq("id", data.lineId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => deleteSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("lines").delete().eq("id", data.lineId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
