/** Opt-in localhost test service. Never imported by app routes or published. */
import { proxyFetch, allowedUrl, unb64u } from "../../src/lib/stream-proxy.server";
import { resolveDashTarget } from "../../src/lib/dash-manifest.server";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.env.PLAYBACK_FIXTURE_ROOT ?? "/tmp/browser/phase2/fixtures";
const scope = "fixture:1";
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.hostname !== "fixtures.test") return originalFetch(input, init);
  const file = resolve(root, `.${url.pathname}`);
  if (!file.startsWith(`${resolve(root)}/`)) return new Response("Forbidden", { status: 403 });
  try {
    const bytes = await readFile(file);
    const type = file.endsWith(".mpd") ? "application/dash+xml" : file.endsWith(".m3u8") ? "application/vnd.apple.mpegurl" : file.endsWith(".webm") ? "video/webm" : file.endsWith(".mp3") ? "audio/mpeg" : "application/octet-stream";
    const headers = new Headers(init?.headers);
    const range = /^bytes=(\d+)-(\d*)$/.exec(headers.get("Range") ?? "");
    if (range) {
      const start = Number(range[1]), end = Math.min(bytes.length - 1, range[2] ? Number(range[2]) : bytes.length - 1);
      return new Response(bytes.subarray(start, end + 1), { status: 206, headers: { "Content-Type": type, "Content-Range": `bytes ${start}-${end}/${bytes.length}`, "Accept-Ranges": "bytes" } });
    }
    return new Response(bytes, { headers: { "Content-Type": type, "Accept-Ranges": "bytes" } });
  } catch { return new Response("Missing fixture", { status: 404 }); }
}) as typeof fetch;

Bun.serve({ hostname: "127.0.0.1", port: 8091, async fetch(request) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Range" } });
  let target: URL | null;
  if (url.pathname.startsWith("/fixture/")) target = new URL(`https://fixtures.test/${url.pathname.slice(9)}`);
  else if (url.pathname === "/proxy") {
    try {
      target = url.searchParams.has("t") ? await resolveDashTarget(url.searchParams, scope) : await allowedUrl(unb64u(url.searchParams.get("u") ?? ""), url.searchParams.get("s") ?? "", scope);
    } catch { target = null; }
  } else return new Response("Not found", { status: 404 });
  if (!target || target.hostname !== "fixtures.test") return new Response("Forbidden", { status: 403 });
  return proxyFetch(request, target, { name: "Fixture", group_title: null, logo: null, referrer: null, url: target.toString() }, "http://localhost:8091/proxy", scope);
} });
console.log("Isolated fixture proxy ready on localhost:8091");