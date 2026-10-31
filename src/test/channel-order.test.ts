import { expect, it } from "vitest";
import { channelNeighbor } from "@/lib/channel-order";
import { buildM3U, parseM3U } from "@/lib/m3u";

const channels = ["A", "B", "C"].map((name) => ({ id: name, name, url: `https://media.test/${name}.mp4`, logo: null, referrer: null, group_title: null }));

it("moves a channel up in the cleaned downloaded playlist", () => {
  const neighbor = channelNeighbor(channels, "B", -1);
  expect(neighbor?.id).toBe("A");
  const reordered = [channels[1], channels[0], channels[2]].filter((c) => c !== undefined);
  expect(parseM3U(buildM3U(reordered)).map((c) => c.name)).toEqual(["B", "A", "C"]);
});
it("finds the next channel for moving down", () => {
  expect(channelNeighbor(channels, "B", 1)?.id).toBe("C");
});
it("does not move past either end or move an unknown channel", () => {
  expect(channelNeighbor(channels, "A", -1)).toBeUndefined();
  expect(channelNeighbor(channels, "C", 1)).toBeUndefined();
  expect(channelNeighbor(channels, "missing", 1)).toBeUndefined();
});