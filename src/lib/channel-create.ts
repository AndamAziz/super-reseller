import { z } from "zod";
import { channelLinksSchema } from "./channel-links";
import { buildM3U, parseM3U, type M3UChannel } from "./m3u";

export const manualChannelSchema = channelLinksSchema.extend({
  type: z.enum(["live", "movie", "series"]),
  user_agent: z.string().trim().max(1000),
});

export function createManualChannel(input: z.input<typeof manualChannelSchema>): M3UChannel {
  const parsed = manualChannelSchema.parse(input);
  for (const value of Object.values(parsed)) {
    if (typeof value === "string" && /[\r\n]/.test(value)) throw new Error("Fields cannot contain new lines");
  }
  // Round-trip through the same parser as uploads to retain an original entry.
  const channel = parseM3U(buildM3U([{ ...parsed, user_agent: parsed.user_agent || null,
    name: parsed.name.replaceAll('"', "'"), group_title: parsed.group_title?.replaceAll('"', "'") ?? null,
  }]))[0];
  if (!channel) throw new Error("Could not create the M3U entry");
  return channel;
}

export function parseManualEntry(text: string): M3UChannel {
  const rows = text.split(/\r?\n/).filter((row) => row.trim());
  if (!rows[0]?.trim().startsWith("#EXTINF:")) throw new Error("Start with an #EXTINF entry");
  if (rows.filter((row) => row.trim().startsWith("#EXTINF")).length !== 1 ||
      rows.filter((row) => !row.trim().startsWith("#")).length !== 1) {
    throw new Error("Enter one complete M3U entry with one stream URL");
  }
  const channel = parseM3U(text)[0];
  if (!channel) throw new Error("Add a stream URL after #EXTINF");
  // Validate exposed values without normalizing the preserved original text.
  channelLinksSchema.parse({ ...channel, group_title: channel.group_title ?? "", logo: channel.logo ?? "", referrer: channel.referrer ?? "" });
  return channel;
}