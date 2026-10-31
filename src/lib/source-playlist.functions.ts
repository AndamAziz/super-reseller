import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** The panel and player APIs read the same last-good GitHub catalog. */
export const getSourcePlaylist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles, error } = await context.supabase.from("user_roles")
      .select("role").eq("user_id", context.userId);
    if (error || !roles?.some(({ role }) => role === "admin" || role === "reseller")) {
      throw new Error("Access denied");
    }
    const { loadCatalog } = await import("./playlist-auth.server");
    const loaded = await loadCatalog();
    if (!loaded.ok) throw new Error(loaded.message);
    const { live, movies, episodes } = loaded.catalog;
    return [...live, ...movies, ...episodes].map((channel, index) => ({
      ...channel, id: `source:${index}:${channel.name}`,
    }));
  });