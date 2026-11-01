import { afterEach, describe, expect, it, vi } from "vitest";
import { proxyFetch, rewritePlaylist, unb64u } from "@/lib/stream-proxy.server";
import { mediaContentType } from "@/lib/media";

afterEach(() => { vi.unstubAllGlobals(); });

const P = "https://app.test/proxy/u/p/1";
const channel = { name: "Ch", group_title: null, logo: null, referrer: null, user_agent: null, url: "https://cdn.test/x" };
const req = () => new Request("https://app.test");
const stubOrigin = (res: Response) => vi.stubGlobal("fetch", vi.fn(async () => res));

describe("HLS master and media playlists", () => {
  it("rewrites variant, key, map and iframe URIs but never tag lines", async () => {
    const master = [
      "#EXTM3U",
      "#EXT-X-VERSION:6",
      '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud",URI="audio.m3u8"',
      "#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=1280x720",
      "hd/index.m3u8",
      '#EXT-X-I-FRAME-STREAM-INF:BANDWIDTH=100000,URI="iframes.m3u8"',
    ].join("\n");
    const out = await rewritePlaylist(master, "https://cdn.test/live/master.m3u8", P, "u:1");
    const lines = out.split("\n");
    expect(lines[1]).toBe("#EXT-X-VERSION:6");
    expect(lines[3]).toBe("#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=1280x720");
    expect(unb64u(new URL(lines[4]!).searchParams.get("u")!)).toBe("https://cdn.test/live/hd/index.m3u8");
    expect(unb64u(new URL(/URI="([^"]+)"/.exec(lines[2]!)![1]!).searchParams.get("u")!)).toBe("https://cdn.test/live/audio.m3u8");
    expect(unb64u(new URL(/URI="([^"]+)"/.exec(lines[5]!)![1]!).searchParams.get("u")!)).toBe("https://cdn.test/live/iframes.m3u8");
  });

  it("rewrites EXT-X-MAP and EXT-X-KEY URIs in media playlists", async () => {
    const media = '#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\n#EXT-X-KEY:METHOD=AES-128,URI="k.key"\n#EXTINF:4,\nseg1.ts\n';
    const out = await rewritePlaylist(media, "https://cdn.test/vod/a.m3u8", P, "u:1");
    expect(unb64u(new URL(/URI="([^"]+)"/.exec(out.split("\n")[1]!)![1]!).searchParams.get("u")!)).toBe("https://cdn.test/vod/init.mp4");
    expect(unb64u(new URL(/URI="([^"]+)"/.exec(out.split("\n")[2]!)![1]!).searchParams.get("u")!)).toBe("https://cdn.test/vod/k.key");
    expect(unb64u(new URL(out.split("\n")[4]!).searchParams.get("u")!)).toBe("https://cdn.test/vod/seg1.ts");
  });

  it("serves an audio-only HLS playlist through the proxy with the right MIME type", async () => {
    stubOrigin(new Response("#EXTM3U\n#EXTINF:10,\nseg1.aac\n", { headers: { "Content-Type": "application/vnd.apple.mpegurl" } }));
    const res = await proxyFetch(req(), new URL("https://cdn.test/radio.m3u8"), channel, P, "u:1");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/vnd.apple.mpegurl");
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(unb64u(new URL((await res.text()).split("\n")[2]!).searchParams.get("u")!)).toBe("https://cdn.test/seg1.aac");
  });
});

describe("Segment and VOD streaming", () => {
  it.each([
    ["seg.ts", "video/mp2t"], ["movie.mkv", "video/x-matroska"], ["song.aac", "audio/aac"], ["clip.webm", "video/webm"],
  ])("streams %s as %s with CORS and length headers", async (file, type) => {
    stubOrigin(new Response(new Uint8Array([1, 2]), { headers: { "Content-Type": "application/octet-stream", "Content-Length": "2" } }));
    const res = await proxyFetch(req(), new URL(`https://cdn.test/${file}`), channel, P, "u:1");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(type);
    expect(res.headers.get("content-length")).toBe("2");
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect([...new Uint8Array(await res.arrayBuffer())]).toEqual([1, 2]);
  });

  it("keeps a declared MKV content type from the origin", async () => {
    stubOrigin(new Response(new Uint8Array([1]), { headers: { "Content-Type": "video/x-matroska" } }));
    const res = await proxyFetch(req(), new URL("https://cdn.test/movie.mkv"), channel, P, "u:1");
    expect(res.headers.get("content-type")).toBe("video/x-matroska");
  });
});

describe("Origin failures never fake success", () => {
  it.each([403, 404, 500])("maps origin HTTP %s to a plain 502 error", async (status) => {
    stubOrigin(new Response("nope", { status }));
    const res = await proxyFetch(req(), new URL("https://cdn.test/x.ts"), channel, P, "u:1");
    expect(res.status).toBe(502);
    expect(await res.text()).toBe(`Stream origin error (HTTP ${status})`);
  });

  it("blocks a redirect hop to a private address", async () => {
    stubOrigin(new Response(null, { status: 302, headers: { Location: "http://169.254.169.254/latest/meta-data" } }));
    const res = await proxyFetch(req(), new URL("https://cdn.test/x.m3u8"), channel, P, "u:1");
    expect(res.status).toBe(403);
    expect(await res.text()).toBe("Forbidden target");
  });

  it("follows a public redirect and streams the final response", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { Location: "https://edge.test/final.ts" } }))
      .mockResolvedValueOnce(new Response(new Uint8Array([9]), { headers: { "Content-Type": "video/mp2t" } }));
    vi.stubGlobal("fetch", fetcher);
    const res = await proxyFetch(req(), new URL("https://cdn.test/x.ts"), channel, P, "u:1");
    expect(res.status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect([...new Uint8Array(await res.arrayBuffer())]).toEqual([9]);
  });
});

describe("Content type mapping", () => {
  it.each([
    ["a.mp3", "audio/mpeg"], ["a.mp4", "video/mp4"], ["a.m4a", "audio/mp4"], ["a.aac", "audio/aac"],
    ["a.ogg", "audio/ogg"], ["a.wav", "audio/wav"], ["a.mkv", "video/x-matroska"], ["a.ts", "video/mp2t"],
    ["a.m3u8", "application/vnd.apple.mpegurl"],
  ])("maps %s to %s", (file, type) => {
    expect(mediaContentType(`https://cdn.test/${file}`)).toBe(type);
  });
});
