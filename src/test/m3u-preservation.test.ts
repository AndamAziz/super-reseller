import { expect, it } from "vitest";
import { buildM3U, mediaSection, parseM3U, parseM3UDocument } from "@/lib/m3u";

const fixture = '#EXTM3U x-tvg-url="https://epg.test/guide.xml"\r\n#EXTINF:-1 tvg-id="n1" group-title="Movies News",Live, News\r\nhttps://media.test/live.m3u8\r\n#EXTINF:120 tvg-type="movie" tvg-id="m1" group-title="Films",Film\r\n#EXTVLCOPT:http-user-agent=CustomPlayer\r\n#KODIPROP:inputstream.adaptive.license_type=clearkey\r\nhttps://media.test/film.mp4\r\n#EXTINF:-1 tvg-type="series" group-title="Drama",Show - S01E01\r\nhttps://media.test/episode.mp4';

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