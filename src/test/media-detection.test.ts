import { describe, expect, it } from "vitest";
import { detectMedia } from "@/lib/media-detection";
import { peekStream } from "@/lib/stream-peek";
import { playbackVerdict } from "@/lib/playback-verdict";
import { playlistVersion } from "@/lib/playlist-version";

describe("Actual media detection", () => {
  it("detects extensionless HLS despite a wrong upstream type", () => expect(detectMedia(new TextEncoder().encode("#EXTM3U\nsegment.ts"), "video/mp2t", "https://media.test/live")).toBe("hls"));
  it("detects DASH XML independently of extension", () => expect(detectMedia(new TextEncoder().encode('<?xml version="1.0"?><MPD xmlns="urn:mpeg:dash:schema:mpd:2011"/>'))).toBe("dash"));
  it("detects MP4 signatures before misleading HLS extensions", () => expect(detectMedia(new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]), "application/octet-stream", "https://media.test/a.m3u8")).toBe("mp4"));
  it("detects transport packets", () => { const bytes = new Uint8Array(564); bytes[0] = bytes[188] = bytes[376] = 0x47; expect(detectMedia(bytes)).toBe("ts"); });
  it("detects transport sync after a partial packet despite a misleading MIME", () => {
    const bytes = new Uint8Array(564); bytes[17] = bytes[205] = bytes[393] = 0x47;
    expect(detectMedia(bytes, "application/x-mpegURL", "https://media.test/live.TS")).toBe("ts");
  });
  it("collects a fragmented HLS signature behind a TS URL and replays it", async () => {
    const bytes = new TextEncoder().encode("#EXTM3U\n#EXTINF:4,\nsegment.ts\n");
    const stream = new ReadableStream({ start(controller) {
      controller.enqueue(bytes.slice(0, 3)); controller.enqueue(bytes.slice(3, 6)); controller.enqueue(bytes.slice(6)); controller.close();
    } });
    const peek = await peekStream(stream);
    expect(detectMedia(peek.bytes, "video/mp2t", "https://media.test/live.TS")).toBe("hls");
    expect([...new Uint8Array(await new Response(peek.body).arrayBuffer())]).toEqual([...bytes]);
  });
  it("does not classify an HTML error as a playlist", () => expect(detectMedia(new TextEncoder().encode("<!doctype html><html>error</html>"), "text/html", "https://media.test/a.m3u8")).toBe("unknown"));
  it("replays every byte after bounded signature inspection", async () => {
    const bytes = new Uint8Array(12000).map((_, index) => index % 251);
    const stream = new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close(); } });
    const peek = await peekStream(stream);
    expect(peek.bytes.length).toBe(4096);
    expect(new Uint8Array(await new Response(peek.body).arrayBuffer())).toEqual(bytes);
  });
  it("rejects HTTP-only evidence without decoded frames/audio", () => expect(playbackVerdict({ secondsAdvanced: 10, frames: 0, width: 0, audioPeak: 0, error: null, expectsVideo: true, expectsAudio: true }).ok).toBe(false));
  it("requires five seconds of progress and actual audio signal", () => {
    expect(playbackVerdict({ secondsAdvanced: 6, frames: 30, width: 640, audioPeak: 0.1, error: null, expectsVideo: true, expectsAudio: true }).ok).toBe(true);
    expect(playbackVerdict({ secondsAdvanced: 1, frames: 30, width: 640, audioPeak: 0.1, error: null, expectsVideo: true, expectsAudio: true }).ok).toBe(false);
  });
  it("detects URL/version rotation even when channel names do not change", async () => {
    const before = "#EXTM3U\n#EXTINF:-1,One\nhttps://media.test/old.mp4";
    expect(await playlistVersion(before)).toBe(await playlistVersion(before));
    expect(await playlistVersion(before.replace("old.mp4", "new.mp4"))).not.toBe(await playlistVersion(before));
  });
});