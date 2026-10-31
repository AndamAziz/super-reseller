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
/** Identity ignores the source URL so rotating URLs do not require a player refresh. */
export function channelIdentity(channel: { name: string; group_title: string | null }): string {
  const identity = JSON.stringify([channel.name, channel.group_title]);
  let a = 2166136261, b = 5381;
  for (const char of identity) {
    a = Math.imul(a ^ char.charCodeAt(0), 16777619);
    b = Math.imul(b, 33) ^ char.charCodeAt(0);
  }
  return `${(a >>> 0).toString(16).padStart(8, "0")}${(b >>> 0).toString(16).padStart(8, "0")}`;
}
export function resolveChannel<T extends { name: string; group_title: string | null }>(items: T[], id: number, identity: string | null): T | undefined {
  return identity ? items.find((channel) => channelIdentity(channel) === identity) : items[id - 1];
}
export function playbackUrl(origin: string, kind: MediaKind, username: string, password: string, id: number, source: string, channel?: { name: string; group_title: string | null }): string {
  const path = `${origin}/api/public/${kind}/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${id}.${mediaExtension(source)}`;
  return channel ? `${path}?channel=${channelIdentity(channel)}` : path;
}