import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type { StreamTestStep } from "./stream-test.server";

/** Admin-only: fetch a channel's playlist chain and first segment through the same proxy logic players use. */
export const testStream = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ streamId: z.number().int().min(1).optional(), url: z.string().url().max(2000).optional(), referrer: z.string().max(500).nullable().optional(), user_agent: z.string().max(2000).nullable().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Admins only");
    const { probeStream } = await import("./stream-test.server");
    // A selected URL must keep its uploaded headers and work during GitHub outages.
    if (data.url) {
      const ch = { name: "test", group_title: null, logo: null, url: data.url, referrer: data.referrer ?? null, user_agent: data.user_agent ?? null };
      return { name: ch.name, streamId: null, ...await probeStream(ch) };
    }
    const { loadChannels } = await import("./playlist-auth.server");
    const loaded = await loadChannels();
    if (!loaded.ok) throw new Error(loaded.message);
    const ch = data.streamId ? loaded.channels[data.streamId - 1] : undefined;
    if (!ch) throw new Error(`Stream ${data.streamId} not found`);
    return { name: ch.name, streamId: data.streamId ?? null, ...await probeStream(ch) };
  });
