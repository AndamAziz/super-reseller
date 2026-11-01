import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Prepare only a saved channel and an authorized active line; never signs arbitrary URLs. */
export const preparePlaybackCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ lineId: z.string().uuid(), channelIndex: z.number().int().min(0) }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: admin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!admin) throw new Error("Admins only");
    const { data: line } = await context.supabase.from("lines").select("username,password,expires_at").eq("id", data.lineId).maybeSingle();
    if (!line || new Date(line.expires_at).getTime() <= Date.now()) throw new Error("Choose an active authorized line");
    const { loadCatalog } = await import("./playlist-auth.server");
    const { playbackUrl, channelIdentity } = await import("./media");
    const loaded = await loadCatalog();
    if (!loaded.ok) throw new Error(loaded.message);
    const channel = loaded.catalog.channels[data.channelIndex];
    if (!channel) throw new Error("Channel not found");
    const kind = channel.type === "movie" ? "movie" : channel.type === "series" ? "series" : "live";
    const items = kind === "movie" ? loaded.catalog.movies : kind === "series" ? loaded.catalog.episodes : loaded.catalog.live;
    const id = items.findIndex((item) => channelIdentity(item) === channelIdentity(channel)) + 1;
    return { name: channel.name, path: playbackUrl("", kind, line.username, line.password, id, channel.url, channel) };
  });