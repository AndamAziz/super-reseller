import type { M3UChannel } from "./m3u";
import { allowedUrl, proxyFetch, unb64u } from "./stream-proxy.server";

export type StreamTestStep = { step: string; url: string; status: number | null; ok: boolean; error: string | null; ms: number };

/** Probe the selected channel, not a URL-matching entry in another catalog. */
async function probeOnce(channel: M3UChannel) {
  const scope = "admin-test:0";
  const prefix = "https://proxy.test/proxy/test/test/0";
  const steps: StreamTestStep[] = [];
  let target = new URL(channel.url);
  let label = "Playlist";
  let mediaReceived = false;
  for (let depth = 0; depth < 5; depth++) {
    const started = Date.now();
    try {
      const res = await proxyFetch(new Request(prefix), target, channel, prefix, scope);
      const success = res.status === 200 || res.status === 206;
      if (!success) {
        const error = (await res.text()).slice(0, 300);
        const originStatus = /Stream origin error \(HTTP (\d+)\)/.exec(error);
        steps.push({ step: label, url: target.toString(), status: originStatus ? Number(originStatus[1]) : res.status, ok: false, error, ms: Date.now() - started });
        break;
      }
      if (!/mpegurl/i.test(res.headers.get("content-type") ?? "")) {
        // Headers alone do not prove playback: require a byte, then close the live stream.
        const reader = res.body?.getReader();
        let received = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          if (reader) {
            const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("No media data received within 15 seconds")), 15000); });
            while (!received) {
              const chunk = await Promise.race([reader.read(), deadline]);
              if (chunk.done) break;
              received = !!chunk.value?.byteLength;
            }
          }
        } finally {
          clearTimeout(timer);
          await reader?.cancel();
        }
        mediaReceived = received;
        steps.push({ step: depth === 0 ? "Media" : "First segment", url: target.toString(), status: res.status, ok: received, error: received ? null : "Empty media response", ms: Date.now() - started });
        break;
      }
      const text = await res.text();
      steps.push({ step: label, url: target.toString(), status: res.status, ok: true, error: null, ms: Date.now() - started });
      const first = text.split(/\r?\n/).map((line) => line.trim()).find((line) => line.startsWith(prefix));
      if (!first) throw new Error("Playlist contains no segments or variants");
      const link = new URL(first);
      const next = await allowedUrl(unb64u(link.searchParams.get("u") ?? ""), link.searchParams.get("s") ?? "", scope);
      if (!next) throw new Error("Forbidden target");
      target = next;
      label = "Variant playlist or segment";
    } catch (error) {
      steps.push({ step: label, url: target.toString(), status: null, ok: false, error: error instanceof Error ? error.message : String(error), ms: Date.now() - started });
      break;
    }
  }
  if (!mediaReceived && steps.every((step) => step.ok)) {
    steps.push({ step: "First segment", url: target.toString(), status: null, ok: false, error: "Playlist chain exceeded the test depth limit", ms: 0 });
  }
  return { steps, ok: mediaReceived && steps.every((step) => step.ok) };
}

export async function probeStream(channel: M3UChannel) {
  const first = await probeOnce(channel);
  const failed = first.steps.find((step) => !step.ok);
  // Some IPTV origins briefly reject a redirected request. Recheck once, not forever.
  if (!first.ok && failed && (failed.status === null || [400, 502, 503, 504].includes(failed.status))) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return probeOnce(channel);
  }
  return first;
}