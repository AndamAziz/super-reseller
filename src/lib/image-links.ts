import { supabase } from '@/integrations/supabase/client';
import type { ConvertedImage } from '@/lib/image-conversion';
export const IMAGE_PAGE_SIZE = 20;
export const IMAGE_CACHE_SECONDS = '31536000';
export async function requireImageAdmin() {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return false;
  const { data, error } = await supabase.rpc('has_role', { _user_id: auth.user.id, _role: 'admin' });
  if (error) throw error;
  return data === true;
}
export async function listImageLinks(search: string, page: number) {
  let query = supabase.from('image_links').select('*', { count: 'exact' }).order('created_at', { ascending: false }).order('id');
  if (search.trim()) query = query.ilike('original_name', `%${search.replace(/[\\%_]/g, '\\$&')}%`);
  const { data, error, count } = await query.range(page * IMAGE_PAGE_SIZE, (page + 1) * IMAGE_PAGE_SIZE - 1);
  if (error) throw error;
  return { rows: data, count: count ?? 0 };
}
export async function uploadImageLink(original: File, converted: ConvertedImage, progress: (value: number) => void) {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error('Please sign in again.');
  const path = `${Array.from(crypto.getRandomValues(new Uint8Array(8)), b => b.toString(16).padStart(2, '0')).join('')}.${converted.format}`;
  progress(10);
  // XHR provides byte-level progress; authenticated storage APIs still enforce RLS.
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) throw new Error('Please sign in again.');
  const base = import.meta.env['VITE_SUPABASE_URL'];
  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', `${base}/storage/v1/object/channel-images/${path}`);
    request.setRequestHeader('Authorization', `Bearer ${session.session?.access_token}`);
    request.setRequestHeader('apikey', import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY']);
    request.setRequestHeader('Content-Type', converted.blob.type);
    request.setRequestHeader('Cache-Control', `public, max-age=${IMAGE_CACHE_SECONDS}, immutable`);
    request.upload.onprogress = event => { if (event.lengthComputable) progress(Math.round(10 + event.loaded / event.total * 80)); };
    request.onerror = () => reject(new Error('Upload connection failed. Try again.'));
    request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error('Image upload failed. Please try again.'));
    request.send(converted.blob);
  });
  const url = supabase.storage.from('channel-images').getPublicUrl(path).data.publicUrl;
  const { data, error } = await supabase.from('image_links').insert({ path, url, original_name: original.name, format: converted.format, width: converted.width, height: converted.height, size_bytes: converted.blob.size, created_by: auth.user.id }).select().single();
  if (error) { await supabase.storage.from('channel-images').remove([path]); throw error; }
  progress(100); return data;
}
export async function deleteImageLink(id: string, path: string) {
  const { error: storageError } = await supabase.storage.from('channel-images').remove([path]);
  if (storageError) throw storageError;
  const { error } = await supabase.from('image_links').delete().eq('id', id);
  if (error) throw error;
}
// Short public link served by our redirect route on the published domain.
export const IMAGE_SHORT_HOST = 'https://re.andam.uk';
export function imageShortUrl(path: string) {
  return `${IMAGE_SHORT_HOST}/api/public/i/${path}`;
}