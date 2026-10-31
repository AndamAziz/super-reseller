import { z } from "zod";

const httpUrl = z.string().trim().max(4000).url("Enter a valid URL")
  .refine((value) => /^https?:\/\//i.test(value), "Use an HTTP or HTTPS URL");

export const channelLinksSchema = z.object({
  url: httpUrl,
  logo: z.union([httpUrl, z.literal("")]).transform((value) => value || null),
});