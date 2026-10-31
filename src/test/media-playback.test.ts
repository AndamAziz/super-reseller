import { afterEach, describe, expect, it, vi } from "vitest";
import { mediaExtension, playbackUrl } from "@/lib/media";
import { createPlaylistCache } from "@/lib/playlist-cache";
import { parseM3U } from "@/lib/m3u";
import { proxyFetch } from "@/lib/stream-proxy.server";

afterEach(() => vi.unstubAllGlobals());
describe("Playlist media", () => {
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