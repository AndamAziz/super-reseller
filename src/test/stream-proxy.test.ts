import { describe, expect, it } from "vitest";
import { allowedUrl, rewritePlaylist, signTarget, unb64u } from "@/lib/stream-proxy.server";

const P = "https://app.test/proxy/u/p/186";
const urls = (out: string) => out.split("\n").filter((l) => l.startsWith(P)).map((l) => unb64u(new URL(l).searchParams.get("u")!));

describe("HLS rewriter", () => {
  const src = "#EXTM3U\n#EXT-X-VERSION:6\n#EXT-X-KEY:METHOD=AES-128,URI=\"key.bin\"\n#EXTINF:4,\nseg1.ts\nhttps://edge22.358598.ir.cdn.ir/hls2/seg2.ts\n";
  it("never rewrites tag lines and resolves relative URIs against the playlist URL", async () => {
    const out = await rewritePlaylist(src, "https://after-redirect.ir/hls2/bein1.m3u8", P, "u:186");
    expect(out).toContain("#EXT-X-VERSION:6");
    expect(out.split("\n")[1]).toBe("#EXT-X-VERSION:6");
    expect(urls(out)).toEqual(["https://after-redirect.ir/hls2/seg1.ts", "https://edge22.358598.ir.cdn.ir/hls2/seg2.ts"]);
    expect(out).toMatch(/URI="https:\/\/app\.test\/proxy/);
  });
  it("allows any host from the signed chain for that user+stream only", async () => {
    const u = "https://edge22.358598.ir.cdn.ir/hls2/seg2.ts";
    const s = await signTarget("u:186", u);
    expect(await allowedUrl(u, s, "u:186")).not.toBeNull();
    expect(await allowedUrl(u, s, "u:45")).toBeNull();
    expect(await allowedUrl("https://evil.com/x", s, "u:186")).toBeNull();
  });
  it("refuses private addresses even when signed", async () => {
    for (const u of ["http://localhost/x", "http://10.0.0.1/x", "http://192.168.1.1/x", "http://172.20.0.1/x", "http://169.254.169.254/x"])
      expect(await allowedUrl(u, await signTarget("u:186", u), "u:186")).toBeNull();
  });
});
