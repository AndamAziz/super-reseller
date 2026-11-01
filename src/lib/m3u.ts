export type M3UMetadata = {
  extinf: string;
  directives: string[];
  raw_url?: string;
  after_url?: string[];
  original: { name: string; group_title: string | null; logo: string | null; referrer: string | null; type: string | null; user_agent: string | null; url?: string };
};

export type M3UChannel = {
  name: string;
  group_title: string | null;
  logo: string | null;
  url: string;
  referrer: string | null;
  type?: string | null;
  user_agent?: string | null;
  m3u_metadata?: M3UMetadata | null;
};

export function mediaSection(channel: Pick<M3UChannel, "type">): "live" | "movie" | "series" {
  const type = channel.type?.toLowerCase();
  return type === "movie" || type === "series" ? type : "live";
}

/** Keeps the document header and line-ending convention alongside channel metadata. */
export function parseM3UDocument(text: string) {
  const lines = text.split(/\r?\n/);
  const firstEntry = lines.findIndex((line) => line.trim().startsWith("#EXTINF"));
  const header = firstEntry >= 0 ? lines.slice(0, firstEntry).join("\n") : "#EXTM3U";
  return { channels: parseM3U(text), header, newline: text.includes("\r\n") ? "\r\n" : "\n" };
}

/** Parses standard (and loosely formatted) EXTM3U playlists. */
export function parseM3U(text: string): M3UChannel[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const out: M3UChannel[] = [];
  let pending: Omit<M3UChannel, "url"> | null = null;
  let extinf = "";
  let directives: string[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (pending) directives.push(raw);
      else out.at(-1)?.m3u_metadata?.after_url?.push(raw);
      continue;
    }
    if (line.startsWith("#EXTINF")) {
      extinf = raw;
      directives = [];
      const attrs: Record<string, string> = {};
      const idx = nameSeparator(line);
      const attributes = idx >= 0 ? line.slice(0, idx) : line;
      for (const m of attributes.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s,]+))/g)) {
        if (m[1]) attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? "";
      }
      const name = (idx >= 0 ? line.slice(idx + 1) : "").trim();
      const ref = attrs["http-referrer"] || attrs[":http-referrer"] || "";
      pending = {
        name: name || attrs["tvg-name"] || "Unnamed",
        group_title: attrs["group-title"] || null,
        logo: attrs["tvg-logo"] || null,
        referrer: ref || null,
        user_agent: attrs["http-user-agent"] || null,
        type: (attrs["tvg-type"] || "").toLowerCase() || null,
      };
    } else if (/^#EXTVLCOPT:http-referrer=/i.test(line)) {
      directives.push(raw);
      if (pending) pending.referrer = line.split("=").slice(1).join("=").trim() || pending.referrer;
    } else if (/^#EXTVLCOPT:http-user-agent=/i.test(line)) {
      directives.push(raw);
      if (pending) pending.user_agent = line.split("=").slice(1).join("=").trim() || null;
    } else if (/^#EXTHTTP:/i.test(line)) {
      directives.push(raw);
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
      directives.push(raw);
      if (pending) {
        const h = new URLSearchParams(line.slice(line.indexOf("=") + 1));
        const r = h.get("Referer") ?? h.get("referer"); const ua = h.get("User-Agent") ?? h.get("user-agent");
        if (r) pending.referrer = r; if (ua) pending.user_agent = ua;
      }
    } else if (line.startsWith("#")) {
      if (pending) directives.push(raw);
      else out.at(-1)?.m3u_metadata?.after_url?.push(raw);
      continue;
    } else if (pending) {
      const original = { name: pending.name, group_title: pending.group_title, logo: pending.logo, referrer: pending.referrer, type: pending.type ?? null, user_agent: pending.user_agent ?? null, url: line };
      out.push({ ...pending, url: line, m3u_metadata: { extinf, directives, original, raw_url: raw, after_url: [] } });
      pending = null;
    } else {
      out.at(-1)?.m3u_metadata?.after_url?.push(raw);
    }
  }
  return out;
}

function nameSeparator(line: string): number {
  let quote: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === quote) quote = null;
    else if (!quote && (char === '"' || char === "'")) quote = char;
    if (char === "," && !quote) return i;
  }
  return -1;
}

function setAttribute(line: string, key: string, value: string | null): string {
  const separator = nameSeparator(line);
  let attrs = separator < 0 ? line : line.slice(0, separator);
  const suffix = separator < 0 ? "" : line.slice(separator);
  const pattern = new RegExp(`(^|[\\s"'])(${key}\\s*=\\s*)(?:"[^"]*"|'[^']*'|[^\\s,]+)`, "ig");
  let found = false;
  attrs = attrs.replace(pattern, (match, prefix: string, assignment: string) => {
    found = true;
    if (value === null) return prefix;
    const quote = match.slice(prefix.length + assignment.length)[0] === "'" ? "'" : '"';
    return prefix + assignment + quote + value.replaceAll(quote, quote === '"' ? "'" : '"') + quote;
  });
  if (!found && value !== null) attrs += ` ${key}="${value.replace(/"/g, "'")}"`;
  return attrs + suffix;
}

function updatedDirectives(channel: M3UChannel, metadata: M3UMetadata): string[] {
  const refChanged = channel.referrer !== metadata.original.referrer;
  const uaChanged = (channel.user_agent ?? null) !== metadata.original.user_agent;
  if (!refChanged && !uaChanged) return metadata.directives;
  const rows = metadata.directives.flatMap((raw) => {
    if (refChanged && /^#EXTVLCOPT:http-referrer=/i.test(raw.trim())) return [];
    if (uaChanged && /^#EXTVLCOPT:http-user-agent=/i.test(raw.trim())) return [];
    if (/^#EXTHTTP:/i.test(raw.trim())) {
      try {
        const headers = JSON.parse(raw.trim().slice(9)) as Record<string, string>;
        for (const key of Object.keys(headers)) {
          if (refChanged && /^refer/i.test(key)) delete headers[key];
          if (uaChanged && /^user-agent$/i.test(key)) delete headers[key];
        }
        return [`#EXTHTTP:${JSON.stringify(headers)}`];
      } catch { return [raw]; }
    }
    if (/^#KODIPROP:inputstream\.adaptive\.(stream_)?headers=/i.test(raw.trim())) {
      const idx = raw.indexOf("=");
      const headers = new URLSearchParams(raw.slice(idx + 1));
      for (const key of [...headers.keys()]) {
        if (refChanged && /^refer/i.test(key)) headers.delete(key);
        if (uaChanged && /^user-agent$/i.test(key)) headers.delete(key);
      }
      return [raw.slice(0, idx + 1) + headers.toString()];
    }
    return [raw];
  });
  if (refChanged && channel.referrer) rows.push(`#EXTVLCOPT:http-referrer=${channel.referrer}`);
  if (uaChanged && channel.user_agent) rows.push(`#EXTVLCOPT:http-user-agent=${channel.user_agent}`);
  return rows;
}

export function buildM3U(channels: M3UChannel[], document?: { header?: string | undefined; newline?: string | undefined }): string {
  const rows = [document?.header ?? "#EXTM3U"];
  for (const c of channels) {
    const metadata = c.m3u_metadata;
    if (metadata) {
      let line = metadata.extinf;
      const original = metadata.original;
      if (c.name !== original.name) {
        const idx = nameSeparator(line);
        line = (idx < 0 ? line + "," : line.slice(0, idx + 1)) + c.name;
      }
      for (const [key, value, before] of [
        ["tvg-logo", c.logo, original.logo], ["group-title", c.group_title, original.group_title],
        ["http-referrer", c.referrer, original.referrer],
        [":http-referrer", c.referrer, original.referrer],
      ]) {
        if (value !== before && key && (key !== "http-referrer" && key !== ":http-referrer" || line.includes(`${key}=`))) line = setAttribute(line, key, value ?? null);
      }
      rows.push(line, ...updatedDirectives(c, metadata), c.url === original.url ? metadata.raw_url ?? c.url : c.url, ...metadata.after_url ?? []);
      continue;
    }
    const attrs = [`tvg-name="${c.name}"`];
    if (c.logo) attrs.push(`tvg-logo="${c.logo}"`);
    if (c.group_title) attrs.push(`group-title="${c.group_title}"`);
    if (c.type) attrs.push(`tvg-type="${c.type}"`);
    rows.push(`#EXTINF:-1 ${attrs.join(" ")},${c.name}`);
    if (c.referrer) rows.push(`#EXTVLCOPT:http-referrer=${c.referrer}`);
    if (c.user_agent) rows.push(`#EXTVLCOPT:http-user-agent=${c.user_agent}`);
    rows.push(c.url);
  }
  return rows.join("\n").replace(/\n/g, document?.newline ?? "\n");
}
