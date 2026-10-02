import { createFileRoute } from "@tanstack/react-router";

// One-time setup endpoint: creates the default super admin if no admin exists.
export const Route = createFileRoute("/api/public/bootstrap-admin")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { count } = await supabaseAdmin
          .from("user_roles")
          .select("*", { count: "exact", head: true })
          .eq("role", "admin");
        if ((count ?? 0) > 0) return new Response("already done", { status: 409 });
        const email = "andam@outlook.com";
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: "Admin123",
          email_confirm: true,
        });
        if (error || !data.user) return new Response(error?.message ?? "fail", { status: 500 });
        await supabaseAdmin.from("profiles").insert({ id: data.user.id, email, display_name: "Super Admin" });
        await supabaseAdmin.from("user_roles").insert({ user_id: data.user.id, role: "admin" });
        return new Response("ok");
      },
    },
  },
});
