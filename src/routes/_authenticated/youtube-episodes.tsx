import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, Film, Loader2, Trash2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { AdminOnly } from '@/components/admin-only';
import { PageHeader } from '@/components/panel';
import { Button } from '@/components/ui/button';
import { deletePublicVideo, listPublicVideos, uploadPublicVideo, validateMp4 } from '@/lib/public-videos';

export const Route = createFileRoute('/_authenticated/youtube-episodes')({
  head: () => ({ meta: [
    { title: 'MP4 uploads — Kurdistan IPTV' },
    { name: 'description', content: 'Admin-only MP4 video upload management for Kurdistan IPTV.' },
    { property: 'og:title', content: 'MP4 uploads — Kurdistan IPTV' },
    { property: 'og:description', content: 'Admin-only MP4 video upload management for Kurdistan IPTV.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary' },
  ] }),
  component: () => <AdminOnly><VideoUploads /></AdminOnly>,
});

function VideoUploads() {
  const queryClient = useQueryClient();
  const { data: videos = [], isPending, error } = useQuery({ queryKey: ['public-videos'], queryFn: listPublicVideos });
  const fileInput = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  useEffect(() => () => { controller.current?.abort(); }, []);
  async function upload(file: File) {
    try {
      validateMp4(file);
      setUploading(file.name); setProgress(0);
      const abort = new AbortController(); controller.current = abort;
      await uploadPublicVideo(file, setProgress, abort.signal);
      toast.success('MP4 uploaded');
      await queryClient.invalidateQueries({ queryKey: ['public-videos'] });
    } catch (uploadError) {
      if (uploadError instanceof DOMException && uploadError.name === 'AbortError') toast.info('Upload cancelled');
      else toast.error(uploadError instanceof Error ? uploadError.message : 'Upload failed. Try again.');
    } finally { setUploading(null); controller.current = null; if (fileInput.current) fileInput.current.value = ''; }
  }
  async function copy(url: string) {
    try { await navigator.clipboard.writeText(url); setCopied(url); toast.success('Public link copied'); }
    catch { toast.error('Could not copy the link.'); }
  }
  async function remove(path: string) {
    if (!window.confirm('Delete this video? Its public link will stop working.')) return;
    setDeleting(path);
    try { await deletePublicVideo(path); await queryClient.invalidateQueries({ queryKey: ['public-videos'] }); toast.success('Video deleted'); }
    catch { toast.error('Could not delete the video.'); }
    finally { setDeleting(null); }
  }
  return <>
    <PageHeader eyebrow="Media · Admin" title="MP4 uploads" actions={<Button disabled={!!uploading} onClick={() => fileInput.current?.click()} className="min-h-11"><Upload className="size-4" />Upload MP4</Button>} />
    <input ref={fileInput} type="file" accept=".mp4,video/mp4" className="hidden" aria-label="MP4 file" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
    {uploading && <section aria-live="polite" className="space-y-3 border-y border-border bg-glass p-4">
      <div className="flex items-center gap-3"><Loader2 className="size-5 shrink-0 animate-spin text-primary" /><span className="min-w-0 flex-1 break-all">{uploading}</span><span className="font-mono">{progress}%</span><Button variant="ghost" size="icon" aria-label="Cancel upload" title="Cancel upload" onClick={() => controller.current?.abort()}><X className="size-4" /></Button></div>
      <progress aria-label="Upload progress" value={progress} max={100} className="h-2 w-full accent-primary" />
    </section>}
    <section className="border-y border-border bg-glass">
      <div className="flex items-center justify-between border-b border-border px-4 py-4 sm:px-6">
        <h2 className="font-display text-lg font-semibold">Video files</h2><span className="text-muted-foreground">{videos.length}</span>
      </div>
      {isPending && <p className="p-6 text-muted-foreground">Loading videos…</p>}
      {error && <div role="alert" className="flex flex-wrap items-center gap-3 p-6 text-destructive"><span>Could not load videos.</span><Button variant="outline" onClick={() => void queryClient.invalidateQueries({ queryKey: ['public-videos'] })}>Retry</Button></div>}
      {!isPending && !error && videos.length === 0 && <div className="grid justify-items-center gap-3 px-4 py-14 text-muted-foreground"><Film className="size-10" /><p>No uploaded videos.</p></div>}
      <div className="divide-y divide-border">{videos.map((video) => <article key={video.path} className="grid min-w-0 gap-4 p-4 sm:p-6">
        <div className="flex min-w-0 items-start gap-3"><Film className="mt-1 size-5 shrink-0 text-primary" /><div className="min-w-0 flex-1"><h3 className="break-all font-semibold">{video.name}</h3><p className="mt-1 text-xs text-muted-foreground">{(video.bytes / 1024 ** 2).toFixed(1)} MB · {new Date(video.createdAt).toLocaleDateString()}</p></div><Button variant="ghost" className="size-11 shrink-0 text-destructive" aria-label={`Delete ${video.name}`} title="Delete video" disabled={deleting === video.path} onClick={() => void remove(video.path)}><Trash2 className="size-4" /></Button></div>
        <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"><input aria-label={`Public link for ${video.name}`} readOnly value={video.url} className="min-h-11 min-w-0 rounded-lg border border-border bg-background px-3 text-sm text-muted-foreground" onFocus={(event) => event.target.select()} /><Button variant="outline" className="min-h-11" onClick={() => void copy(video.url)}>{copied === video.url ? <Check className="size-4" /> : <Copy className="size-4" />}Copy public link</Button></div>
      </article>)}</div>
    </section>
  </>;
}
