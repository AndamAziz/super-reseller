import { supabase } from "@/integrations/supabase/client";
import type { M3UChannel } from "./m3u";

export type SourceChannel = M3UChannel & { id: string };

/**
 * The shared GitHub catalog for the Playlists page, read in the browser.
 *
 * The stored row (provider_catalog_cache, ~2 MB deflated) is fetched straight from Supabase
 * and inflated here with DecompressionStream, so the Worker spends no CPU on it (the server
 * function needed ~350 ms per call to inflate, parse and re-serialise ~26 MB, far over the free
 * Workers CPU limit). Every poll only reads the row's etag / checked_at; the catalog itself is
 * downloaded again only when that stamp changes. Same rows and ids as getSourcePlaylist.
 */
let last: { stamp: string; rows: SourceChannel[] } | undefined;

async function inflate(base64: string): Promise<string> {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Response(stream).text();
}

export async function fetchSourcePlaylistDirect(): Promise<SourceChannel[]> {
  const meta = await supabase.from("provider_catalog_cache").select("etag, checked_at").eq("key", "github").maybeSingle();
  if (meta.error) throw new Error("Stored playlist temporarily unavailable");
  if (!meta.data) throw new Error("Playlist cache is not ready; retry shortly");
  const stamp = meta.data.etag || meta.data.checked_at;
  if (last && last.stamp === stamp) return last.rows;

  const row = await supabase.from("provider_catalog_cache").select("catalog").eq("key", "github").maybeSingle();
  if (row.error || !row.data) throw new Error("Stored playlist temporarily unavailable");
  const value = row.data.catalog as { encoding?: string; data?: string; channels?: M3UChannel[] };
  const channels: M3UChannel[] = value.encoding === "deflate-base64" && value.data
    ? (JSON.parse(await inflate(value.data)) as { channels: M3UChannel[] }).channels
    : value.channels ?? [];
  const rows = channels.map((channel, index) => ({ ...channel, id: `source:${index}:${channel.name}` }));
  last = { stamp, rows };
  return rows;
}
