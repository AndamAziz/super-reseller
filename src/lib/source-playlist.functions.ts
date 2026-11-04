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
    return loaded.catalog.channels.map((channel, index) => ({
      ...channel, id: `source:${index}:${channel.name}`,
    }));
  });

export const getSourcePlaylistVersion = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    if (!roles?.some(({ role }) => role === "admin" || role === "reseller")) throw new Error("Access denied");
    const { loadCatalog } = await import("./playlist-auth.server");
    const loaded = await loadCatalog();
    if (!loaded.ok) throw new Error(loaded.message);
    return { version: loaded.catalog.version, channelCount: loaded.catalog.channels.length };
  });

export const refreshSourcePlaylist = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: admin } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' });
    if (!admin) throw new Error('Access denied');
    const { refreshCatalog } = await import('./playlist-auth.server');
    const catalog = await refreshCatalog(true);
    return { version: catalog.version, channelCount: catalog.channels.length };
  });