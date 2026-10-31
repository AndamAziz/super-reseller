import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type StreamTestStep = { step: string; url: string; status: number | null; ok: boolean; error: string | null; ms: number };

/** Admin-only: fetch a channel's playlist chain and first segment through the same proxy logic players use. */
export const testStream = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ streamId: z.number().int().min(1).optional(), url: z.string().url().max(2000).optional(), referrer: z.string().max(500).nullable().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Admins only");
    const { loadChannels } = await import("./playlist-auth.server");
    const { proxyFetch, allowedUrl, unb64u } = await import("./stream-proxy.server");

    const loaded = await loadChannels();
    const idx = !loaded.ok ? -1 : data.streamId ? (data.streamId <= loaded.channels.length ? data.streamId - 1 : -1) : loaded.channels.findIndex((c) => c.url === data.url);
    if (idx < 0 && !data.url) throw new Error(loaded.ok ? `Stream ${data.streamId} not found` : loaded.message);
    const existing = idx >= 0 && loaded.ok ? loaded.channels[idx] : undefined;
    if (!existing && !data.url) throw new Error("Stream not found");
    const ch = existing ?? { name: "test", group_title: null, logo: null, url: data.url ?? "", referrer: data.referrer ?? null };
    const scope = "admin-test:0";
    const prefix = "https://proxy.test/proxy/test/test/0";
    const steps: StreamTestStep[] = [];

    let target = new URL(ch.url);
    let label = "Playlist";
    for (let depth = 0; depth < 5; depth++) {
      const t0 = Date.now();
      let res: Response;
      try {
        res = await proxyFetch(new Request(prefix), target, ch, prefix, scope);
      } catch (e) {
        steps.push({ step: label, url: target.toString(), status: null, ok: false, error: e instanceof Error ? e.message : String(e), ms: Date.now() - t0 });
        break;
      }
      const ok = res.status === 200 || res.status === 206;
      const isPlaylist = /mpegurl/i.test(res.headers.get("content-type") ?? "");
      if (!ok) {
        steps.push({ step: label, url: target.toString(), status: res.status, ok, error: (await res.text()).slice(0, 300), ms: Date.now() - t0 });
        break;
      }
      if (!isPlaylist) {
        await res.body?.cancel();
        steps.push({ step: depth === 0 ? "Media" : label, url: target.toString(), status: res.status, ok, error: null, ms: Date.now() - t0 });
        break;
      }
      const text = await res.text();
      steps.push({ step: label, url: target.toString(), status: res.status, ok, error: null, ms: Date.now() - t0 });
      const first = text.split("\n").find((l) => l.startsWith(prefix));
      if (!first) {
        steps.push({ step: "Segment", url: "—", status: null, ok: false, error: "Playlist contains no segments or variants", ms: 0 });
        break;
      }
      const u = new URL(first);
      const next = await allowedUrl(unb64u(u.searchParams.get("u") ?? ""), u.searchParams.get("s") ?? "", scope);
      if (!next) {
        steps.push({ step: "Segment", url: unb64u(u.searchParams.get("u") ?? ""), status: 403, ok: false, error: "Forbidden target", ms: 0 });
        break;
      }
      target = next;
      label = /\.m3u8?$/i.test(next.pathname) ? "Variant playlist" : "First segment";
    }
    return { name: ch.name, streamId: idx >= 0 ? idx + 1 : null, steps, ok: steps.length > 0 && steps.every((s) => s.ok) && steps.at(-1)?.step !== "Playlist" };
  });
