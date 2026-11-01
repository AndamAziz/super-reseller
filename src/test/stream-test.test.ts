import { afterEach, describe, expect, it, vi } from "vitest";
import { probeStream } from "@/lib/stream-test.server";

afterEach(() => vi.unstubAllGlobals());
const channel = { name: "Test", group_title: null, logo: null, url: "http://media.test/live/2902.ts", referrer: "https://referer.test/", user_agent: "IPTV player" };

describe("Admin stream probing", () => {
  it("follows a TS URL redirect to HLS and reads the first segment with selected headers", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "https://edge.test/live.m3u8" } }))
      .mockResolvedValueOnce(new Response("#EXTM3U\n#EXTINF:4,\nhttps://segments.test/one.ts", { headers: { "content-type": "application/octet-stream" } }))
      .mockResolvedValueOnce(new Response(new Uint8Array([71, 1, 2]), { headers: { "content-type": "video/mp2t" } }));
    vi.stubGlobal("fetch", fetcher);
    const result = await probeStream(channel);
    expect(result.ok).toBe(true);
    expect(result.steps.map((step) => step.status)).toEqual([200, 200]);
    expect(fetcher).toHaveBeenCalledTimes(3);
    for (const call of fetcher.mock.calls) expect(call[1].headers).toMatchObject({ "User-Agent": "IPTV player", Referer: "https://referer.test/" });
  });
  it("tests direct transport stream bytes without trying to parse a playlist", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Uint8Array([71, 1]), { headers: { "content-type": "video/mp2t" } })));
    const result = await probeStream(channel);
    expect(result.ok).toBe(true);
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]?.step).toBe("Media");
  });
  it("reports the exact origin status instead of masking a 403 as 502", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Denied", { status: 403 })));
    const result = await probeStream(channel);
    expect(result.ok).toBe(false);
    expect(result.steps[0]?.status).toBe(403);
  });
  it("rechecks a temporary origin 400 once and requires media bytes on the retry", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response("Bad request", { status: 400 }))
      .mockResolvedValueOnce(new Response(new Uint8Array([71, 1]), { headers: { "content-type": "video/mp2t" } }));
    vi.stubGlobal("fetch", fetcher);
    const result = await probeStream(channel);
    expect(result.ok).toBe(true);
    expect(result.steps[0]?.status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("does not claim success for empty media", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
    const result = await probeStream(channel);
    expect(result.ok).toBe(false);
    expect(result.steps[0]?.error).toBe("Empty media response");
  });
  it("does not claim success when five nested playlists never reach media", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response("#EXTM3U\nnext.m3u8", { headers: { "content-type": "application/x-mpegURL" } })));
    const result = await probeStream(channel);
    expect(result.ok).toBe(false);
    expect(result.steps.at(-1)?.error).toContain("depth limit");
  });
});