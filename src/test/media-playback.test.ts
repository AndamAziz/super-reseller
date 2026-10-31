import { afterEach, describe, expect, it, vi } from "vitest";
import { channelIdentity, resolveChannel, mediaExtension, playbackUrl } from "@/lib/media";
import { createPlaylistCache } from "@/lib/playlist-cache";
import { parseM3U } from "@/lib/m3u";
import { proxyFetch, rewritePlaylist } from "@/lib/stream-proxy.server";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("Playlist media", () => {
  it("keeps an existing link on the same channel after reordering and URL rotation", () => {
    const channel = { name: "Quran", group_title: "Audio", url: "https://media.test/old.mp3" };
    const link = new URL(playbackUrl("https://app.test", "live", "u", "p", 1, channel.url, channel));
    const replacement = { ...channel, url: "https://media.test/new.mp3" };
    expect(resolveChannel([{ name: "Other", group_title: null, url: "https://media.test/other.mp3" }, replacement], 1, link.searchParams.get("channel"))?.url).toBe("https://media.test/new.mp3");
    expect(resolveChannel([], 1, channelIdentity(channel))).toBeUndefined();
  });
  it("propagates channel identity into HLS segment links", async () => {
    const out = await rewritePlaylist("#EXTM3U\nsegment.ts", "https://media.test/live.m3u8", "https://app.test/proxy/u/p/1?channel=1234567890abcdef", "u:1234567890abcdef");
    const link = new URL(out.split("\n")[1] ?? "");
    expect(link.searchParams.get("channel")).toBe("1234567890abcdef");
    expect(link.searchParams.get("u")).toBeTruthy();
    expect(link.searchParams.get("s")).toBeTruthy();
  });
  it("does not abort a playing MP3 after the 15 second header deadline", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn(async (_url, options) => { signal = options.signal; return new Response(new Uint8Array([1]), { headers: { "Content-Type": "audio/mpeg" } }); }));
    const url = "https://media.test/long.mp3";
    const res = await proxyFetch(new Request("https://app.test"), new URL(url), { name: "Quran", group_title: null, referrer: null, logo: null, url }, "https://app.test/proxy", "u:1");
    await vi.advanceTimersByTimeAsync(20_000);
    expect(signal?.aborted).toBe(false);
    expect(await res.arrayBuffer()).toHaveProperty("byteLength", 1);
  });
  it("recovers from a temporary 503 without a manual refresh", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response("Temporary", { status: 503 })).mockResolvedValueOnce(new Response("audio", { headers: { "Content-Type": "audio/mpeg" } }));
    vi.stubGlobal("fetch", fetcher);
    const url = "https://media.test/quran.mp3";
    const res = await proxyFetch(new Request("https://app.test"), new URL(url), { name: "Quran", group_title: null, referrer: null, logo: null, url }, "https://app.test/proxy", "u:1");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("audio");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it.each(["mp3", "mp4", "m3u8"])("preserves %s for player playback", (format) => {
    const source = `https://media.test/quran.${format}?token=public`;
    expect(mediaExtension(source)).toBe(format);
    expect(playbackUrl("https://app.test", "live", "user", "pass", 1, source)).toBe(`https://app.test/api/public/live/user/pass/1.${format}`);
    expect(parseM3U(`#EXTM3U\n#EXTINF:-1 tvg-name="Quran",Quran\n${source}`)[0]?.url).toBe(source);
  });
  it("refreshes GitHub additions after 60 seconds", async () => {
    let at = 0;
    const load = vi.fn().mockResolvedValueOnce(["old"]).mockResolvedValueOnce(["old", "quran.mp3"]);
    const read = createPlaylistCache(load, () => at);
    expect(await read()).toEqual(["old"]);
    at = 59_999;
    expect(await read()).toEqual(["old"]);
    at = 60_000;
    expect(await read()).toEqual(["old", "quran.mp3"]);
    expect(load).toHaveBeenCalledTimes(2);
  });
  it("keeps the last working playlist on an outage and retries", async () => {
    let at = 0;
    const load = vi.fn().mockResolvedValueOnce(["working"]).mockRejectedValueOnce(new Error("outage")).mockResolvedValueOnce(["new"]);
    const read = createPlaylistCache(load, () => at);
    await read();
    at = 60_000;
    expect(await read()).toEqual(["working"]);
    at = 75_000;
    expect(await read()).toEqual(["new"]);
  });
  it.each([["mp3", "audio/mpeg"], ["mp4", "video/mp4"]])("streams %s bytes and preserves seeking", async (ext, type) => {
    const fetcher = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), {
      status: 206, headers: { "Content-Type": "application/octet-stream", "Content-Range": "bytes 0-2/30", "Accept-Ranges": "bytes" },
    }));
    vi.stubGlobal("fetch", fetcher);
    const source = `https://media.test/quran.${ext}`;
    const res = await proxyFetch(new Request("https://app.test", { headers: { Range: "bytes=0-2" } }), new URL(source),
      { name: "Quran", url: source, group_title: null, logo: null, referrer: "https://quran.test/", user_agent: "QuranPlayer" }, "https://app.test/api/public/media-proxy/live/u/p/1", "u:1");
    expect(res.status).toBe(206);
    expect(res.headers.get("content-type")).toBe(type);
    expect(res.headers.get("content-range")).toBe("bytes 0-2/30");
    expect([...new Uint8Array(await res.arrayBuffer())]).toEqual([1, 2, 3]);
    expect(fetcher.mock.calls[0]?.[1].headers).toMatchObject({ Range: "bytes=0-2", Referer: "https://quran.test/", "User-Agent": "QuranPlayer" });
  });
});