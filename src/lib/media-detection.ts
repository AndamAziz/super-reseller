/** Container/transport detection is not a codec compatibility verdict. */
export type MediaProtocol = "hls" | "dash" | "ts" | "mp4" | "mp3" | "aac" | "ogg" | "wav" | "webm" | "matroska" | "avi" | "flv" | "unknown";
export const protocolMime: Record<MediaProtocol, string> = {
  hls: "application/vnd.apple.mpegurl", dash: "application/dash+xml", ts: "video/mp2t",
  mp4: "video/mp4", mp3: "audio/mpeg", aac: "audio/aac", ogg: "audio/ogg", wav: "audio/wav",
  webm: "video/webm", matroska: "video/x-matroska", avi: "video/x-msvideo", flv: "video/x-flv", unknown: "application/octet-stream",
};
export function detectMedia(bytes: Uint8Array, contentType = "", source = ""): MediaProtocol {
  const text = new TextDecoder().decode(bytes.slice(0, 4096)).replace(/^\uFEFF/, "").trimStart();
  if (text.startsWith("#EXTM3U")) return "hls";
  if (/^(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*<(?:\w+:)?MPD[\s>]/i.test(text)) return "dash";
  // Network reads may begin before the first complete transport packet.
  for (let offset = 0; offset < 188 && offset + 376 < bytes.length; offset++) {
    if (bytes[offset] === 0x47 && bytes[offset + 188] === 0x47 && bytes[offset + 376] === 0x47) return "ts";
  }
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (["ftyp", "styp", "moof"].includes(ascii(4, 8))) return "mp4";
  if (ascii(0, 3) === "ID3") return "mp3";
  if (bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xf6) === 0xf0) return "aac";
  if (bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0) return "mp3";
  if (ascii(0, 4) === "OggS") return "ogg";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE") return "wav";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "AVI ") return "avi";
  if (ascii(0, 3) === "FLV") return "flv";
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return text.includes("webm") ? "webm" : "matroska";
  // A labelled error document must never become successful media by headers or filename.
  if (/^\s*<(?:!doctype\s+html|html)|^\s*[\[{]/i.test(text)) return "unknown";
  if (/mpegurl/i.test(contentType)) return "hls";
  if (/dash\+xml/i.test(contentType)) return "dash";
  if (/video\/mp2t/i.test(contentType)) return "ts";
  if (/audio\/mpeg/i.test(contentType)) return "mp3";
  if (/audio\/aac/i.test(contentType)) return "aac";
  if (/(video|audio)\/mp4/i.test(contentType)) return "mp4";
  if (/ogg/i.test(contentType)) return "ogg";
  if (/wav/i.test(contentType)) return "wav";
  if (/webm/i.test(contentType)) return "webm";
  if (/matroska/i.test(contentType)) return "matroska";
  if (/msvideo/i.test(contentType)) return "avi";
  if (/x-flv/i.test(contentType)) return "flv";
  try {
    const ext = new URL(source).pathname.split(".").pop()?.toLowerCase();
    const map: Record<string, MediaProtocol> = { m3u: "hls", m3u8: "hls", mpd: "dash", ts: "ts", mp4: "mp4", m4a: "mp4", mp3: "mp3", aac: "aac", ogg: "ogg", wav: "wav", webm: "webm", mkv: "matroska", avi: "avi", flv: "flv" };
    return ext ? map[ext] ?? "unknown" : "unknown";
  } catch { return "unknown"; }
}