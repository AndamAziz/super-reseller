import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Admins only");
}

export const createReseller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        password: z.string().min(6).max(72),
        displayName: z.string().trim().min(1).max(80),
        credits: z.number().int().min(0).max(100000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (error || !created.user) throw new Error(error?.message ?? "Could not create user");
    const id = created.user.id;
    const { error: pErr } = await supabaseAdmin
      .from("profiles")
      .insert({ id, email: data.email, display_name: data.displayName, credits: data.credits });
    if (pErr) {
      await supabaseAdmin.auth.admin.deleteUser(id);
      throw new Error(pErr.message);
    }
    await supabaseAdmin.from("user_roles").insert({ user_id: id, role: "reseller" });
    if (data.credits > 0) {
      await supabaseAdmin.from("credit_transactions").insert({
        reseller_id: id,
        actor_id: context.userId,
        amount: data.credits,
        reason: "Opening balance",
      });
    }
    return { id };
  });

export const deleteReseller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.id === context.userId) throw new Error("You cannot delete yourself");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: data.id, _role: "admin" });
    if (isAdmin) throw new Error("Cannot delete an admin");
    await supabaseAdmin.from("profiles").delete().eq("id", data.id);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.id);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
