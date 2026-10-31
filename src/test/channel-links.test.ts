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
});