import { expect, it } from "vitest";
import { createManualChannel, parseManualEntry } from "@/lib/channel-create";
import { buildM3U, mediaSection, parseM3UDocument } from "@/lib/m3u";

it.each(["live", "movie", "series"] as const)("manual %s entry retains its explicit media type", (type) => {
  const channel = createManualChannel({ name: "چاناڵ", type, group_title: "Drama", url: "https://media.test/a.mp4", logo: "", referrer: "https://ref.test/", user_agent: "Player" });
  expect(mediaSection(channel)).toBe(type);
  expect(channel.referrer).toBe("https://ref.test/");
  expect(channel.user_agent).toBe("Player");
  expect(channel.name).toBe("چاناڵ");
});

it("appends a supplied entry without changing original attributes, header or CRLF format", () => {
  const original = '#EXTM3U custom="keep"\r\n#EXTINF:-1 tvg-id="old",Live\r\nhttps://media.test/live.ts';
  const raw = '#EXTINF:120 tvg-type="series" tmdb-id="123" custom="a,b" group-title="Drama",Show S01E02\n#EXTVLCOPT:http-user-agent=Player\nhttps://media.test/e.mp4';
  const doc = parseM3UDocument(original);
  const added = parseManualEntry(raw);
  expect(mediaSection(added)).toBe("series");
  expect(buildM3U([...doc.channels, JSON.parse(JSON.stringify(added))], doc)).toBe(original + '\r\n' + raw.replaceAll('\n', '\r\n'));
});

it("classifies pasted entries only by tvg-type, not names or category", () => {
  expect(mediaSection(parseManualEntry('#EXTINF:-1 group-title="Movies",Show tvg-type="series"\nhttps://media.test/live.ts'))).toBe("live");
});

it("rejects incomplete, multiple or non-HTTP entries before saving", () => {
  expect(() => parseManualEntry('#EXTINF:-1,Missing')).toThrow();
  expect(() => parseManualEntry('#EXTINF:-1,A\nhttps://media.test/a\nhttps://media.test/b')).toThrow();
  expect(() => parseManualEntry('#EXTINF:-1,A\nfile:///etc/passwd')).toThrow();
});