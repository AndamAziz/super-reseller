import { describe, expect, it } from "vitest";
import { DOMParser } from "@xmldom/xmldom";
import { rewriteDash, resolveDashTarget } from "@/lib/dash-manifest.server";
import { allowedUrl, unb64u } from "@/lib/stream-proxy.server";
const prefix = "https://app.test/api/public/media-proxy/live/u/p/1?channel=1234567890abcdef";
const source = '<MPD xmlns="urn:mpeg:dash:schema:mpd:2011"><BaseURL>https://cdn.test/assets/</BaseURL><Period><AdaptationSet><SegmentTemplate initialization="$RepresentationID$/init.mp4" media="$RepresentationID$/seg-$Number%05d$.m4s" duration="4"/><Representation id="video" bandwidth="300000"><BaseURL>tracks/</BaseURL></Representation></AdaptationSet></Period></MPD>';
describe("Signed DASH delivery", () => {
  it("resolves inherited bases and templates, preserves identity and padded numbering", async () => {
    const rewritten = await rewriteDash(source, "https://origin.test/live/manifest.mpd", prefix, "u:1");
    const doc = new DOMParser().parseFromString(rewritten, "application/xml");
    const media = doc.getElementsByTagName("SegmentTemplate")[0]?.getAttribute("media");
    const params = new URL(media ?? "").searchParams;
    expect(params.get("channel")).toBe("1234567890abcdef");
    params.set("dRepresentationID", "video"); params.set("dNumber", "42");
    expect((await resolveDashTarget(params, "u:1"))?.toString()).toBe("https://cdn.test/assets/tracks/video/seg-00042.m4s");
    expect(await resolveDashTarget(params, "other:1")).toBeNull();
    params.set("dRepresentationID", "../../private");
    expect(await resolveDashTarget(params, "u:1")).toBeNull();
  });
  it("signs SegmentList initialization and media on different public hosts", async () => {
    const rewritten = await rewriteDash('<MPD><Period><AdaptationSet><Representation id="1"><SegmentList><Initialization sourceURL="init.mp4"/><SegmentURL media="https://edge.test/a.m4s"/></SegmentList></Representation></AdaptationSet></Period></MPD>', "https://origin.test/a.mpd", prefix, "u:1");
    const doc = new DOMParser().parseFromString(rewritten, "application/xml");
    const link = new URL(doc.getElementsByTagName("SegmentURL")[0]?.getAttribute("media") ?? "");
    expect((await allowedUrl(unb64u(link.searchParams.get("u") ?? ""), link.searchParams.get("s") ?? "", "u:1"))?.hostname).toBe("edge.test");
  });
  it("does not permit private template hosts or forged templates", async () => {
    const rewritten = await rewriteDash(source.replace("https://cdn.test", "http://127.0.0.1"), "https://origin.test/a.mpd", prefix, "u:1");
    const doc = new DOMParser().parseFromString(rewritten, "application/xml");
    const params = new URL(doc.getElementsByTagName("SegmentTemplate")[0]?.getAttribute("media") ?? "").searchParams;
    params.set("dRepresentationID", "1"); params.set("dNumber", "1");
    expect(await resolveDashTarget(params, "u:1")).toBeNull();
    params.set("s", "forged"); expect(await resolveDashTarget(params, "u:1")).toBeNull();
  });
  it("rejects document entities rather than processing external XML", async () => expect(rewriteDash('<!DOCTYPE MPD [<!ENTITY x SYSTEM "file:///secret">]><MPD/>', "https://origin.test/a.mpd", prefix, "u:1")).rejects.toThrow("declarations"));
  it('retains DASH audio and subtitle language, codec and role descriptors', async () => {
    const src = '<MPD><Period><AdaptationSet contentType="audio" lang="ku"><Role schemeIdUri="urn:mpeg:dash:role:2011" value="main"/><Representation id="a" codecs="mp4a.40.2"><BaseURL>audio.mp4</BaseURL></Representation></AdaptationSet><AdaptationSet contentType="text" lang="en"><Representation id="s" codecs="wvtt"><BaseURL>subs.mp4</BaseURL></Representation></AdaptationSet></Period></MPD>';
    const doc = new DOMParser().parseFromString(await rewriteDash(src, 'https://origin.test/a.mpd', prefix, 'u:1'), 'application/xml');
    expect(doc.getElementsByTagName('AdaptationSet')[0]?.getAttribute('lang')).toBe('ku');
    expect(doc.getElementsByTagName('AdaptationSet')[1]?.getAttribute('lang')).toBe('en');
    expect(doc.getElementsByTagName('Representation')[0]?.getAttribute('codecs')).toBe('mp4a.40.2');
    expect(doc.getElementsByTagName('Representation')[1]?.getAttribute('codecs')).toBe('wvtt');
    expect(doc.getElementsByTagName('Role')[0]?.getAttribute('value')).toBe('main');
  });
});