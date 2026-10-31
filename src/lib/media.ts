export type MediaKind = "live" | "movie" | "series";
export function mediaExtension(source: string): string {
  try {
    const match = /\.(mp3|mp4|m4a|aac|ogg|wav|webm|mkv|ts|m3u8?)(?:$)/i.exec(new URL(source).pathname);
    return match?.[1]?.toLowerCase() ?? "m3u8";
  } catch { return "m3u8"; }
}
export function mediaContentType(source: string): string {
  const types: Record<string, string> = {
    mp3: "audio/mpeg", mp4: "video/mp4", m4a: "audio/mp4", aac: "audio/aac",
    ogg: "audio/ogg", wav: "audio/wav", webm: "video/webm", mkv: "video/x-matroska",
    ts: "video/mp2t", m3u: "application/vnd.apple.mpegurl", m3u8: "application/vnd.apple.mpegurl",
  };
  return types[mediaExtension(source)] ?? "application/octet-stream";
}
export function playbackUrl(origin: string, kind: MediaKind, username: string, password: string, id: number, source: string): string {
  return `${origin}/api/public/${kind}/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${id}.${mediaExtension(source)}`;
}