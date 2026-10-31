import { describe, it, expect } from "vitest";
import { parseM3U } from "@/lib/m3u";
import { buildCatalog } from "@/lib/playlist-auth.server";

const src = (groups: string[]) => "#EXTM3U\n" + groups.map((g, i) => `#EXTINF:-1 group-title="${g}",Ch${i}\nhttp://x.test/${i}.m3u8`).join("\n");
const order = (text: string) => [...new Set(buildCatalog(parseM3U(text)).live.map((c) => c.group_title))];

describe("category order follows the GitHub playlist", () => {
  it("keeps first-appearance order", () => {
    expect(order(src(["Sport", "Kurdish", "Sport", "News"]))).toEqual(["Sport", "Kurdish", "News"]);
  });
  it("reordering the playlist reorders categories", () => {
    expect(order(src(["News", "Kurdish", "Sport"]))).toEqual(["News", "Kurdish", "Sport"]);
  });
  it("preserves source category order across live, movies and series", () => {
    const catalog = buildCatalog(parseM3U('#EXTM3U\n#EXTINF:-1 tvg-type="series" group-title="Drama",Show - S01E01\nhttps://x.test/episode.mp4\n#EXTINF:-1 group-title="News",News\nhttps://x.test/live.m3u8\n#EXTINF:-1 tvg-type="movie" group-title="Films",Film\nhttps://x.test/movie.mp4'));
    expect(catalog.channels.map((c) => c.group_title)).toEqual(["Drama", "News", "Films"]);
  });
});
