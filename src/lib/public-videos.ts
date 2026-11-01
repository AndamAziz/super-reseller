import { supabase } from '@/integrations/supabase/client';

export const VIDEO_BUCKET = 'public-videos';
export const MAX_VIDEO_BYTES = 5 * 1024 ** 3;
export function validateMp4(file: Pick<File, 'name' | 'size'>) {
  if (!/\.mp4$/i.test(file.name)) throw new Error('Choose an MP4 file.');
  if (file.size === 0 || file.size > MAX_VIDEO_BYTES) throw new Error('Choose a non-empty MP4 file up to 5 GB.');
}
export function videoPublicUrl(path: string) {
  return supabase.storage.from(VIDEO_BUCKET).getPublicUrl(path).data.publicUrl;
}
export type PublicVideo = { path: string; name: string; bytes: number; createdAt: string; url: string };
export async function listPublicVideos(): Promise<PublicVideo[]> {
  const bucket = supabase.storage.from(VIDEO_BUCKET);
  const videos: PublicVideo[] = [];
  async function entries(prefix: string) {
    const all = [];
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await bucket.list(prefix, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } });
      if (error) throw error;
      all.push(...data);
      if (data.length < 100) return all;
    }
  }
  for (const folder of await entries('')) {
    if (folder.id) continue;
    for (const file of await entries(folder.name)) {
      if (!file.id || !/\.mp4$/i.test(file.name)) continue;
      const path = `${folder.name}/${file.name}`;
      videos.push({ path, name: file.name.replace(/^[a-f0-9-]{36}_/, ''), bytes: Number(file.metadata?.size ?? 0), createdAt: file.created_at ?? '', url: videoPublicUrl(path) });
    }
  }
  return videos.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function uploadPublicVideo(file: File, onProgress: (percent: number) => void, signal: AbortSignal) {
  validateMp4(file);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Sign in again to upload.');
  const path = `${user.id}/${crypto.randomUUID()}_${file.name.replace(/[^\p{L}\p{N}._-]/gu, '_')}`;
  signal.throwIfAborted();
  if (file.size <= 6 * 1024 ** 2) {
    const { error: uploadError } = await supabase.storage.from(VIDEO_BUCKET).upload(path, file, { contentType: 'video/mp4', cacheControl: '3600', upsert: false });
    if (uploadError) throw uploadError;
    if (signal.aborted) {
      await supabase.storage.from(VIDEO_BUCKET).remove([path]);
      signal.throwIfAborted();
    }
    onProgress(100);
  } else {
    const { Upload } = await import('tus-js-client');
    await new Promise<void>((resolve, reject) => {
      const endpoint = `${import.meta.env['VITE_SUPABASE_URL']}/storage/v1/upload/resumable`;
      const upload = new Upload(file, {
        endpoint, chunkSize: 6 * 1024 ** 2, retryDelays: [0, 1000, 3000, 5000],
        uploadDataDuringCreation: true, removeFingerprintOnSuccess: true,
        metadata: { bucketName: VIDEO_BUCKET, objectName: path, contentType: 'video/mp4', cacheControl: '3600' },
        onBeforeRequest: async (request) => {
          const { data } = await supabase.auth.getSession();
          if (!data.session) throw new Error('Sign in again to upload.');
          request.setHeader('Authorization', `Bearer ${data.session.access_token}`);
          request.setHeader('apikey', import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY']);
        },
        onProgress: (sent, total) => onProgress(Math.round(sent / total * 100)),
        onError: (uploadError) => { signal.removeEventListener('abort', cancel); reject(uploadError); },
        onSuccess: () => { signal.removeEventListener('abort', cancel); resolve(); },
      });
      function cancel() { void upload.abort(true).finally(() => reject(new DOMException('Upload cancelled', 'AbortError'))); }
      signal.addEventListener('abort', cancel, { once: true });
      if (signal.aborted) cancel(); else upload.start();
    });
  }
  return videoPublicUrl(path);
}
export async function deletePublicVideo(path: string) {
  const { error } = await supabase.storage.from(VIDEO_BUCKET).remove([path]);
  if (error) throw error;
}