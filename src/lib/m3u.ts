export type M3UChannel = {
  name: string;
  group_title: string | null;
  logo: string | null;
  url: string;
  referrer: string | null;
  type?: string | null;
  user_agent?: string | null;
};

/** Parses standard (and loosely formatted) EXTM3U playlists. */
export function parseM3U(text: string): M3UChannel[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const out: M3UChannel[] = [];
  let pending: Omit<M3UChannel, "url"> | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#EXTINF")) {
      const attrs: Record<string, string> = {};
      for (const m of line.matchAll(/([\w:-]+)="([^"]*)"/g)) {
        if (m[1] && m[2] !== undefined) attrs[m[1].toLowerCase()] = m[2];
      }
      // Channel name follows the last comma that isn't inside quotes
      const noQuotes = line.replace(/"[^"]*"/g, '""');
      const idx = noQuotes.lastIndexOf(",");
      const name = (idx >= 0 ? line.slice(line.length - (noQuotes.length - idx - 1)) : "").trim();
      const ref = attrs["http-referrer"] || attrs[":http-referrer"] || "";
      pending = {
        name: name || attrs["tvg-name"] || "Unnamed",
        group_title: attrs["group-title"] || null,
        logo: attrs["tvg-logo"] || null,
        referrer: ref || null,
        user_agent: attrs["http-user-agent"] || null,
        type: (attrs["tvg-type"] || "").toLowerCase() || null,
      };
    } else if (line.startsWith("#EXTVLCOPT:http-referrer=")) {
      if (pending) pending.referrer = line.split("=").slice(1).join("=").trim() || pending.referrer;
    } else if (/^#EXTVLCOPT:http-user-agent=/i.test(line)) {
      if (pending) pending.user_agent = line.split("=").slice(1).join("=").trim() || null;
    } else if (/^#EXTHTTP:/i.test(line)) {
      if (pending) {
        try {
          const h = JSON.parse(line.slice(9)) as Record<string, string>;
          for (const [k, v] of Object.entries(h)) {
            if (/^refer/i.test(k) && v) pending.referrer = v;
            if (/^user-agent$/i.test(k) && v) pending.user_agent = v;
          }
        } catch { /* ignore */ }
      }
    } else if (/^#KODIPROP:inputstream\.adaptive\.(stream_)?headers=/i.test(line)) {
      if (pending) {
        const h = new URLSearchParams(line.slice(line.indexOf("=") + 1));
        const r = h.get("Referer") ?? h.get("referer"); const ua = h.get("User-Agent") ?? h.get("user-agent");
        if (r) pending.referrer = r; if (ua) pending.user_agent = ua;
      }
    } else if (line.startsWith("#")) {
      continue;
    } else if (pending) {
      out.push({ ...pending, url: line });
      pending = null;
    }
  }
  return out;
}

export function buildM3U(channels: M3UChannel[]): string {
  const rows = ["#EXTM3U"];
  for (const c of channels) {
    const attrs = [`tvg-name="${c.name}"`];
    if (c.logo) attrs.push(`tvg-logo="${c.logo}"`);
    if (c.group_title) attrs.push(`group-title="${c.group_title}"`);
    if (c.type) attrs.push(`tvg-type="${c.type}"`);
    rows.push(`#EXTINF:-1 ${attrs.join(" ")},${c.name}`);
    if (c.referrer) rows.push(`#EXTVLCOPT:http-referrer=${c.referrer}`);
    if (c.user_agent) rows.push(`#EXTVLCOPT:http-user-agent=${c.user_agent}`);
    rows.push(c.url);
  }
  return rows.join("\n");
}
