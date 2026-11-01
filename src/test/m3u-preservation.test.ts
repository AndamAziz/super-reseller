import { expect, it } from "vitest";
import { buildM3U, mediaSection, parseM3U, parseM3UDocument } from "@/lib/m3u";

const fixture = '#EXTM3U x-tvg-url="https://epg.test/guide.xml"\r\n#EXTINF:-1 tvg-id="n1" group-title="Movies News",Live, News\r\nhttps://media.test/live.m3u8\r\n#EXTINF:120 tvg-type="movie" tvg-id="m1" group-title="Films",Film\r\n#EXTVLCOPT:http-user-agent=CustomPlayer\r\n#KODIPROP:inputstream.adaptive.license_type=clearkey\r\nhttps://media.test/film.mp4\r\n#EXTINF:-1 tvg-type="series" group-title="Drama",Show - S01E01\r\nhttps://media.test/episode.mp4';

it("retains 14 movies, 92 series episodes and live IDs exactly through persisted import/export", () => {
  const entries = ([ ["movie", 14, "Films"], ["series", 92, "Drama"], ["live", 3, "Live"] ] as const).flatMap(([type, count, group]) =>
    Array.from({ length: count }, (_, i) => `#EXTINF:-1 tvg-id="${type}-${i}"tvg-name="Original ${i}" tvg-logo="https://img.test/${i}.png" tvg-chno="${i}" tvg-type="${type}" group-title="${group}" custom-field="Keep, this",${type} ${i}\r\n#EXTGRP:${group}\r\n#EXTVLCOPT:http-user-agent=Player\r\n#EXTVLCOPT:http-referrer=https://ref.test/\r\nhttps://media.test/${type}/${i}.mp4`));
  const text = '\uFEFF#EXTM3U custom-header="keep"\r\n' + entries.join("\r\n\r\n") + "\r\n# original footer\r\n";
  const doc = parseM3UDocument(text);
  const stored = JSON.parse(JSON.stringify(doc.channels));
  expect(stored.filter((c: typeof doc.channels[number]) => mediaSection(c) === "movie")).toHaveLength(14);
  expect(stored.filter((c: typeof doc.channels[number]) => mediaSection(c) === "series")).toHaveLength(92);
  expect(stored.filter((c: typeof doc.channels[number]) => mediaSection(c) === "live")).toHaveLength(3);
  expect(new Set(doc.channels.filter((c) => mediaSection(c) === "series").map((c) => c.group_title))).toEqual(new Set(["Drama"]));
  expect(buildM3U(stored, doc)).toBe(text);
});

it("replaces edited attributes in place while keeping IDs, types, names and unknown attributes", () => {
  const text = '#EXTM3U\n#EXTINF:-1 tvg-id="id"tvg-logo="old"tvg-name="original" group-title="Drama" tvg-type="series" custom="keep",Episode\nhttps://media.test/a.mp4\n';
  const doc = parseM3UDocument(text);
  const channel = doc.channels[0];
  if (!channel) throw new Error("Missing fixture");
  expect(buildM3U([{ ...channel, name: "New Episode", logo: "new", group_title: "New Drama" }], doc)).toBe(text.replace('tvg-logo="old"', 'tvg-logo="new"').replace('group-title="Drama"', 'group-title="New Drama"').replace(",Episode", ",New Episode"));
});

it("reads type attributes only before the name separator and supports single quotes", () => {
  const doc = parseM3UDocument("#EXTM3U\n#EXTINF:-1 tvg-type='series' group-title='Drama',Show\nhttps://media.test/s.mp4\n#EXTINF:-1 tvg-id=live,Title tvg-type=\"movie\"\nhttps://media.test/l.m3u8");
  expect(doc.channels.map(mediaSection)).toEqual(["series", "live"]);
  expect(buildM3U(doc.channels, doc)).toBe("#EXTM3U\n#EXTINF:-1 tvg-type='series' group-title='Drama',Show\nhttps://media.test/s.mp4\n#EXTINF:-1 tvg-id=live,Title tvg-type=\"movie\"\nhttps://media.test/l.m3u8");
});

it("preserves Live TV, Movies and Series through a serialized import and export", () => {
  const doc = parseM3UDocument(fixture);
  const stored = JSON.parse(JSON.stringify(doc.channels));
  expect(stored.map(mediaSection)).toEqual(["live", "movie", "series"]);
  expect(buildM3U(stored, doc)).toBe(fixture);
});

it("exports edits and deletions without losing media type or other original metadata", () => {
  const doc = parseM3UDocument(fixture);
  const movie = doc.channels[1];
  if (!movie) throw new Error("Missing movie fixture");
  const exported = buildM3U([{ ...movie, name: "Edited Film", logo: "https://img.test/new.png", url: "https://media.test/new.mp4" }, doc.channels[2]].filter((c) => c !== undefined), doc);
  const parsed = parseM3U(exported);
  expect(parsed.map(mediaSection)).toEqual(["movie", "series"]);
  expect(parsed[0]?.name).toBe("Edited Film");
  expect(parsed[0]?.url).toBe("https://media.test/new.mp4");
  expect(exported).toContain('tvg-id="m1"');
  expect(exported).toContain("#EXTINF:120");
  expect(exported).toContain("#KODIPROP:inputstream.adaptive.license_type=clearkey");
  expect(parsed[0]?.user_agent).toBe("CustomPlayer");
});

it("updates Referer without retaining a stale header or removing unrelated headers", () => {
  const doc = parseM3UDocument('#EXTM3U\n#EXTINF:-1 http-referrer="https://old.test/",A\n#EXTHTTP:{"Referer":"https://old.test/","Authorization":"test"}\nhttps://media.test/a.m3u8');
  const channel = doc.channels[0];
  if (!channel) throw new Error("Missing fixture");
  const exported = buildM3U([{ ...channel, referrer: "https://new.test/" }], doc);
  expect(exported).not.toContain("https://old.test/");
  expect(exported).toContain('"Authorization":"test"');
  expect(parseM3U(exported)[0]?.referrer).toBe("https://new.test/");
});