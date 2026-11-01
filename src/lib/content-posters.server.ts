import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

export async function displayPoster(client: SupabaseClient<Database>, value: string | null): Promise<string | null> {
  if (!value) return null;
  const marker = '/storage/v1/object/public/episode-posters/';
  const offset = value.indexOf(marker);
  if (offset < 0) return value;
  const path = decodeURIComponent(value.slice(offset + marker.length));
  const { data } = await client.storage.from('episode-posters').createSignedUrl(path, 3600);
  if (!data) return null;
  // The server's sandbox-local hostname is not browser-reachable.
  const url = new URL(data.signedUrl);
  const browser = new URL(import.meta.env.VITE_SUPABASE_URL);
  url.protocol = browser.protocol; url.host = browser.host;
  return url.toString();
}