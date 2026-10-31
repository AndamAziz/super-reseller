import { expect, it } from "vitest";
import { channelLinksSchema } from "@/lib/channel-links";
import { buildM3U } from "@/lib/m3u";

it("accepts replacement stream and logo URLs and exports both", () => {
  const links = channelLinksSchema.parse({ url: "https://media.test/new.mp4", logo: "https://images.test/new.png" });
  const exported = buildM3U([{ name: "Channel", group_title: "News", referrer: null, ...links }]);
  expect(exported).toContain('tvg-logo="https://images.test/new.png"');
  expect(exported.split("\n").at(-1)).toBe("https://media.test/new.mp4");
});
it("allows removing the logo without removing the stream", () => {
  expect(channelLinksSchema.parse({ url: "https://media.test/audio.mp3", logo: "" }).logo).toBeNull();
});
it("rejects non-HTTP replacement URLs", () => {
  expect(channelLinksSchema.safeParse({ url: "javascript:alert(1)", logo: "" }).success).toBe(false);
  expect(channelLinksSchema.safeParse({ url: "https://media.test/live.m3u8", logo: "file:///tmp/logo.png" }).success).toBe(false);
});it("accepts a renamed channel and category and exports them", () => {
  const edit = channelLinksSchema.parse({ name: " Rudaw HD ", group_title: "Kurdish", referrer: "", url: "https://media.test/r.m3u8", logo: "" });
  expect(edit.name).toBe("Rudaw HD");
  expect(edit.referrer).toBeNull();
  const exported = buildM3U([{ name: edit.name!, group_title: edit.group_title!, referrer: null, url: edit.url, logo: null }]);
  expect(exported).toContain('group-title="Kurdish"');
  expect(exported).toContain(",Rudaw HD");
});
it("rejects an empty channel name", () => {
  expect(channelLinksSchema.safeParse({ name: "  ", url: "https://media.test/a.m3u8", logo: "" }).success).toBe(false);
});
