import { z } from "zod";

const httpUrl = z.string().trim().max(4000).url("Enter a valid URL")
  .refine((value) => /^https?:\/\//i.test(value), "Use an HTTP or HTTPS URL");

const optionalText = (max: number) => z.string().trim().max(max).transform((value) => value || null);

export const channelLinksSchema = z.object({
  name: z.string().trim().min(1, "Enter a channel name").max(300).optional(),
  group_title: optionalText(200).optional(),
  referrer: z.union([httpUrl, z.literal("")]).transform((value) => value || null).optional(),
  url: httpUrl,
  logo: z.union([httpUrl, z.literal("")]).transform((value) => value || null),
});