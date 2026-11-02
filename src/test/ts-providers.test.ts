// End-to-end, provider-independent .ts handling: GitHub source → catalog → generated customer
// M3U / Xtream links → entry playback → signed segment playback. No provider is special-cased.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client.server", () => {
  const row = (table: string) => {
    if (table === "lines") return { id: "line-1", username: "cust", password: "pw", expires_at: "2999-01-01T00:00:00Z", created_at: null, max_connections: 5 };
    if (table === "app_settings") return { value: "https://raw.githubusercontent.com/owner/repo/main/playlist.m3u" };
    return null;
  };
  const query = (table: string) => ({ select: () => ({ eq: () => ({ abortSignal: () => ({ maybeSingle: async () => ({ data: row(table), error: null, status: 200 }) }) }) }) });
  return { supabaseAdmin: { from: query, rpc: async () => ({ data: true, error: null }) } };
});

import { parseM3U, parseM3UDocument, buildM3U } from "@/lib/m3u";
import { handlePlaylistRequest } from "@/lib/playlist-auth.server";
import { handleMediaPlayback } from "@/lib/media-playback.server";
import { channelIdentity } from "@/lib/media";

const TS = (() => { const b = new Uint8Array(752); b[0] = b[188] = b[376] = b[564] = 0x47; return b; })();
const hls = (seg: string) => `#EXTM3U\n#EXT-X-TARGETDURATION:10\n#EXTINF:10,\n${seg}\n`;

// Four unrelated providers, plus non-TS formats that must stay untouched.
const ENTRIES = [
  { name: "Provider A HLS-behind-TS", url: "http://api.alpha.test:80/live/123/123/2902.ts", kind: "hls-behind-ts" },
  { name: "Provider B raw TS with token", url: "https://cdn.bravo.test/stream/77.ts?auth=xyz&exp=99", kind: "raw-ts" },
  { name: "Provider C raw TS uppercase", url: "http://charlie.test/ch/5.TS", kind: "raw-ts" },
  { name: "Provider D HLS-behind-TS with query", url: "http://delta.test/play/9.ts?token=t0k", kind: "hls-behind-ts" },
  { name: "HLS channel", url: "https://hls.test/live/index.m3u8?sig=1", kind: "m3u8" },
  { name: "MP4 movie", url: "https://vod.test/film.mp4", kind: "mp4" },
  { name: "Quran MP3", url: "https://audio.test/surah.mp3", kind: "mp3" },
] as const;
const NEW_PROVIDER = { name: "Provider E added later", url: "http://echo.test/live/u/p/31.ts?k=v", kind: "hls-behind-ts" } as const;

const source = (entries: readonly { name: string; url: string }[]) =>
  `#EXTM3U\n${entries.map((e) => `#EXTINF:-1 tvg-id="${e.name}" group-title="Group",${e.name}\n${e.url}`).join("\n")}\n`;

let playlist = source(ENTRIES);
const originCalls: string[] = [];

function origin(url: URL): Response {
  const href = url.toString();
  originCalls.push(href);
  if (url.hostname === "raw.githubusercontent.com") return new Response(playlist);
  const entry = [...ENTRIES, NEW_PROVIDER].find((e) => new URL(e.url).toString() === href);
  if (entry?.kind === "hls-behind-ts") {
    // The origin itself turns the .ts link into a manifest at another address (query preserved).
    const loc = `${url.origin}/hls${url.pathname.replace(/\.ts$/i, "")}/index.m3u8${url.search}`;
    return new Response(null, { status: 302, headers: { Location: loc } });
  }
  if (/\/index\.m3u8/.test(url.pathname) && url.pathname.startsWith("/hls/")) return new Response(hls("seg-1.ts"), { headers: { "Content-Type": "application/x-mpegURL" } });
  if (entry?.kind === "m3u8") return new Response(hls("chunk.ts"), { headers: { "Content-Type": "application/vnd.apple.mpegurl" } });
  if (entry?.kind === "raw-ts" || /\/(seg-1|chunk)\.ts$/.test(url.pathname)) return new Response(TS.slice(), { headers: { "Content-Type": "text/html" } });
  if (entry?.kind === "mp4") return new Response(new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109]), { headers: { "Content-Type": "video/mp4" } });
  if (entry?.kind === "mp3") return new Response(new Uint8Array([0x49, 0x44, 0x33, 4, 0, 0]), { headers: { "Content-Type": "audio/mpeg" } });
  return new Response("not found", { status: 404 });
}

beforeEach(() => {
  playlist = source(ENTRIES);
  originCalls.length = 0;
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => origin(new URL(input instanceof Request ? input.url : input.toString()))));
});
afterEach(() => vi.unstubAllGlobals());

const APP = "https://app.test";
async function customerPlaylist(refresh = false) {
  const res = await handlePlaylistRequest(new Request(`${APP}/api/public/playlist?username=cust&password=pw${refresh ? "&refresh=1" : ""}`));
  expect(res.status).toBe(200);
  return parseM3U(await res.text());
}
/** Play an app link the way an IPTV player does: dispatch to the shared handler by path. */
async function play(link: string): Promise<Response> {
  const u = new URL(link);
  const seg = /^\/api\/public\/media-proxy\/(live|movie|series)\/([^/]+)\/([^/]+)\/([^/]+)$/.exec(u.pathname);
  if (seg) return handleMediaPlayback(new Request(link), decodeURIComponent(seg[2]!), decodeURIComponent(seg[3]!), seg[4]!, seg[1] as "live", true);
  const entry = /^(?:\/api\/public)?\/(live|movie|series)\/([^/]+)\/([^/]+)\/([^/]+)$/.exec(u.pathname);
  if (!entry) throw new Error(`unexpected link ${link}`);
  return handleMediaPlayback(new Request(link), decodeURIComponent(entry[2]!), decodeURIComponent(entry[3]!), entry[4]!, entry[1] as "live");
}
/** Follow app redirects, then (for HLS) the first signed segment; return the final media response. */
async function playToMedia(link: string) {
  let res = await play(link);
  const hops: string[] = [];
  while (res.status === 302) { const next = res.headers.get("location")!; hops.push(next); res = await play(next); }
  let segment: string | undefined;
  if (res.headers.get("x-media-protocol") === "hls") {
    segment = (await res.text()).split("\n").find((l) => l.startsWith("https://"));
    res = await play(segment!);
  }
  return { res, hops, segment };
}

describe("Global .ts support across providers", () => {
  it("keeps every original GitHub URL (path, query, tokens, case) in the parsed catalog", () => {
    const parsed = parseM3U(playlist);
    expect(parsed.map((c) => c.url)).toEqual(ENTRIES.map((e) => e.url));
  });

  it("round-trips imported playlist records without altering .ts links", () => {
    const doc = parseM3UDocument(playlist);
    const out = buildM3U(doc.channels, { header: doc.header, newline: doc.newline });
    for (const e of ENTRIES) expect(out).toContain(e.url);
  });

  it("generates customer links that keep each source's own extension (no blanket .ts → .m3u8)", async () => {
    const channels = await customerPlaylist(true);
    const exts = channels.map((c) => new URL(c.url).pathname.split(".").pop());
    expect(exts).toEqual(["ts", "ts", "ts", "ts", "m3u8", "mp4", "mp3"]);
    channels.forEach((c, i) => {
      const u = new URL(c.url);
      expect(u.origin).toBe(APP);
      expect(u.searchParams.get("channel")).toBe(channelIdentity({ name: ENTRIES[i]!.name, group_title: "Group" }));
      expect(c.url).not.toContain("token"); // origin credentials never leak into customer links
    });
  });

  it.each(ENTRIES.filter((e) => e.kind === "hls-behind-ts").map((e) => [e.name, e]))("%s: .ts link → .m3u8 app link → playlist → TS segment", async (_n, entry) => {
    const channels = await customerPlaylist(true);
    const link = channels[ENTRIES.indexOf(entry)]!.url;
    const { res, hops, segment } = await playToMedia(link);
    expect(hops).toEqual([link.replace(/\.ts\?/, ".m3u8?")]);
    expect(new URL(segment!).pathname).toMatch(/\/api\/public\/media-proxy\/live\/cust\/pw\/\d+\.ts$/);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("video/mp2t");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(TS);
    expect(originCalls).toContain(new URL(entry.url).toString()); // exact source URL incl. query was fetched
  });

  it.each(ENTRIES.filter((e) => e.kind === "raw-ts").map((e) => [e.name, e]))("%s: .ts link streams TS directly with no redirect", async (_n, entry) => {
    const channels = await customerPlaylist(true);
    const { res, hops } = await playToMedia(channels[ENTRIES.indexOf(entry)]!.url);
    expect(hops).toEqual([]);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("video/mp2t");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(TS);
    expect(originCalls).toContain(new URL(entry.url).toString());
  });

  it("an Xtream player asking for .m3u8 on a raw-TS source is sent to the .ts link", async () => {
    const id = ENTRIES.findIndex((e) => e.name.startsWith("Provider B")) + 1;
    const { res, hops } = await playToMedia(`${APP}/api/public/live/cust/pw/${id}.m3u8`);
    expect(hops).toEqual([`${APP}/api/public/live/cust/pw/${id}.ts`]);
    expect(res.headers.get("content-type")).toBe("video/mp2t");
  });

  it("the legacy /live/... path (server without /api/public) uses the same handling", async () => {
    const id = ENTRIES.findIndex((e) => e.name.startsWith("Provider A")) + 1;
    const { res, hops } = await playToMedia(`${APP}/live/cust/pw/${id}.ts`);
    expect(hops).toEqual([`${APP}/live/cust/pw/${id}.m3u8`]);
    expect(res.headers.get("content-type")).toBe("video/mp2t");
  });

  it.each([
    ["IPv4 with port", "http://203.0.113.55:4050/VideoInput/play.ts"],
    ["IPv4 with query", "http://198.51.100.7/0.ts?auth=abc"],
  ])("number-address provider (%s): the player is handed the exact origin URL", async (_n, url) => {
    playlist = source([...ENTRIES, { name: "IP provider", url }]);
    const channels = await customerPlaylist(true);
    const link = channels.at(-1)!.url;
    expect(new URL(link).pathname).toMatch(/\.ts$/);
    const res = await play(link);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(url);
    expect(originCalls).not.toContain(url); // never fetched server-side
  });

  it("private number addresses stay blocked", async () => {
    playlist = source([...ENTRIES, { name: "Private", url: "http://192.168.1.10/0.ts" }]);
    const channels = await customerPlaylist(true);
    expect((await play(channels.at(-1)!.url)).status).toBe(403);
  });

  it("keeps .m3u8, .mp4 and .mp3 behaviour unchanged", async () => {
    const channels = await customerPlaylist(true);
    const hlsRes = await play(channels[4]!.url);
    expect(hlsRes.status).toBe(200);
    expect(hlsRes.headers.get("x-media-protocol")).toBe("hls");
    const seg = (await hlsRes.text()).split("\n").find((l) => l.startsWith("https://"))!;
    expect((await play(seg)).headers.get("content-type")).toBe("video/mp2t");
    const mp4 = await play(channels[5]!.url);
    expect([mp4.status, mp4.headers.get("content-type")]).toEqual([200, "video/mp4"]);
    const mp3 = await play(channels[6]!.url);
    expect([mp3.status, mp3.headers.get("content-type")]).toEqual([200, "audio/mpeg"]);
  });

  it("a provider added to GitHub later gets the same handling with no code change", async () => {
    playlist = source([...ENTRIES, NEW_PROVIDER]);
    const channels = await customerPlaylist(true);
    const added = channels.at(-1)!;
    expect(added.name).toBe(NEW_PROVIDER.name);
    expect(new URL(added.url).pathname).toMatch(/\.ts$/);
    const { res, hops } = await playToMedia(added.url);
    expect(hops).toHaveLength(1);
    expect(res.headers.get("content-type")).toBe("video/mp2t");
    expect(originCalls).toContain(NEW_PROVIDER.url);
  });
});
