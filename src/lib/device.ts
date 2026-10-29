// Friendly device labels for IPTV players, derived from the stream User-Agent.
export function deviceLabel(ua?: string | null, ip?: string | null): string {
  const u = (ua ?? "").toLowerCase();
  let app = "Unknown app";
  if (u.includes("tivimate")) app = "TiviMate";
  else if (u.includes("smarters")) app = "IPTV Smarters";
  else if (u.includes("xtream")) app = "Xtream player";
  else if (u.includes("ott navigator") || u.includes("ottnavigator")) app = "OTT Navigator";
  else if (u.includes("perfect player") || u.includes("perfectplayer")) app = "Perfect Player";
  else if (u.includes("gse")) app = "GSE Smart IPTV";
  else if (u.includes("kodi")) app = "Kodi";
  else if (u.includes("vlc")) app = "VLC";
  else if (u.includes("ottplayer") || u.includes("ott player")) app = "OTT Player";
  else if (u.includes("iptv") || u.includes("m3u") || u.includes("hls") || u.includes("exoplayer") || u.includes("okhttp")) app = "IPTV app";
  else if (u.includes("mozilla") || u.includes("chrome") || u.includes("safari") || u.includes("firefox")) app = "Web browser";

  let os = "";
  if (u.includes("android")) os = "Android";
  else if (u.includes("iphone")) os = "iPhone";
  else if (u.includes("ipad")) os = "iPad";
  else if (u.includes("apple tv") || u.includes("appletv") || u.includes("atv")) os = "Apple TV";
  else if (u.includes("fire tv") || u.includes("aftn") || u.includes("aftb")) os = "Fire TV";
  else if (u.includes("smart-tv") || u.includes("smarttv") || u.includes("tizen") || u.includes("webos") || u.includes("hbbtv")) os = "Smart TV";
  else if (u.includes("roku")) os = "Roku";
  else if (u.includes("windows")) os = "Windows";
  else if (u.includes("mac os x") || u.includes("macintosh")) os = "macOS";
  else if (u.includes("linux")) os = "Linux";

  const label = os ? `${app} · ${os}` : app;
  return ip ? `${label} (${ip})` : label;
}
