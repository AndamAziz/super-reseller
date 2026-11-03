import { createFileRoute, redirect } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { queryOptions, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Copy, Upload, Trash2, ExternalLink, ChevronLeft, ChevronRight, ImagePlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader, Panel } from '@/components/panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { convertImage, copyImageLink, validateImage, type ConvertedImage, type ImageFormat } from '@/lib/image-conversion';
import { deleteImageLink, IMAGE_PAGE_SIZE, listImageLinks, requireImageAdmin, uploadImageLink } from '@/lib/image-links';

const historyOptions = (search: string, page: number) => queryOptions({ queryKey: ['image-links', search, page], queryFn: () => listImageLinks(search, page) });
export const Route = createFileRoute('/_authenticated/image-to-link')({
  beforeLoad: async () => { if (!await requireImageAdmin()) throw redirect({ to: '/dashboard' }); },
  loader: ({ context }) => context.queryClient.ensureQueryData(historyOptions('', 0)),
  head: () => ({ meta: [
    { title: 'Image to Link — Kurdistan IPTV' },
    { name: 'description', content: 'Admin image uploads and permanent public poster and channel logo links.' },
    { property: 'og:title', content: 'Image to Link — Kurdistan IPTV' },
    { property: 'og:description', content: 'Manage public posters and channel logos for Kurdistan IPTV.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }),
  component: ImageToLink,
});

type Draft = { id: number; file: File; original: string; preview?: string | undefined; converted?: ConvertedImage | undefined; error?: string | undefined; progress: number; url?: string; busy: boolean };
const bytes = (value: number) => value >= 1024 ** 2 ? `${(value / 1024 ** 2).toFixed(2)} MB` : `${(value / 1024).toFixed(1)} KB`;

function ImageToLink() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const { data: history } = useSuspenseQuery(historyOptions(search, page));
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [format, setFormat] = useState<ImageFormat>('webp');
  const [resize, setResize] = useState('original');
  const [custom, setCustom] = useState('600');
  const [working, setWorking] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [deleting, setDeleting] = useState<{ id: string; path: string; original_name: string } | null>(null);
  const [removing, setRemoving] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const ids = useRef(0);
  const urls = useRef(new Set<string>());
  const maxWidth = resize === 'original' ? null : Number(resize === 'custom' ? custom : resize);
  const busy = working || preparing;

  function addFiles(files: File[]) {
    if (busy) return;
    const accepted: Draft[] = [];
    for (const file of files) {
      try { validateImage(file); const original = URL.createObjectURL(file); urls.current.add(original); accepted.push({ id: ++ids.current, file, original, progress: 0, busy: false }); }
      catch (error) { toast.error(error instanceof Error ? `${file.name}: ${error.message}` : 'Invalid image.'); }
    }
    setDrafts(current => [...current, ...accepted]);
  }
  const pendingKey = drafts.filter(d => !d.url).map(d => d.id).join(',');
  useEffect(() => {
    let cancelled = false;
    const pending = drafts.filter(d => !d.url);
    if (!pending.length || working) { setPreparing(false); return; }
    setPreparing(true);
    void (async () => {
      for (const draft of pending) {
        try {
          const converted = await convertImage(draft.file, format, maxWidth);
          if (cancelled) return;
          const preview = URL.createObjectURL(converted.blob); urls.current.add(preview);
          setDrafts(current => current.map(d => { if (d.id !== draft.id) return d; if (d.preview) { URL.revokeObjectURL(d.preview); urls.current.delete(d.preview); } return { ...d, converted, preview, error: undefined }; }));
        } catch (error) { if (!cancelled) setDrafts(current => current.map(d => d.id === draft.id ? { ...d, converted: undefined, error: error instanceof Error ? error.message : 'Conversion failed.' } : d)); }
      }
      if (!cancelled) setPreparing(false);
    })();
    return () => { cancelled = true; };
  }, [pendingKey, format, maxWidth, working]);
  useEffect(() => () => { for (const url of urls.current) URL.revokeObjectURL(url); }, []);
  useEffect(() => {
    const paste = (event: ClipboardEvent) => { const files = Array.from(event.clipboardData?.files ?? []).filter(f => f.type.startsWith('image/')); if (files.length) { event.preventDefault(); addFiles(files); } };
    document.addEventListener('paste', paste);
    return () => document.removeEventListener('paste', paste);
  }, [busy]);
  async function copy(text: string) { try { await copyImageLink(text); toast.success('Link copied'); } catch (error) { toast.error(error instanceof Error ? error.message : 'Copy failed.'); } }
  async function upload() {
    setWorking(true);
    for (const draft of drafts.filter(d => d.converted && !d.url)) {
      if (!draft.converted) continue;
      setDrafts(current => current.map(d => d.id === draft.id ? { ...d, busy: true, error: undefined } : d));
      try {
        const saved = await uploadImageLink(draft.file, draft.converted, progress => setDrafts(current => current.map(d => d.id === draft.id ? { ...d, progress } : d)));
        setDrafts(current => current.map(d => d.id === draft.id ? { ...d, busy: false, url: saved.url } : d));
      } catch (error) {
        console.error('Image upload failed', draft.file.name, error);
        const message = error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String((error as { message: unknown }).message) : 'Upload failed.';
        setDrafts(current => current.map(d => d.id === draft.id ? { ...d, busy: false, error: message } : d));
        toast.error(`${draft.file.name}: ${message}`);
      }
    }
    await qc.invalidateQueries({ queryKey: ['image-links'] }); setWorking(false);
  }
  async function remove() {
    if (!deleting) return;
    setRemoving(true);
    try { await deleteImageLink(deleting.id, deleting.path); setDrafts(current => current.filter(d => d.url !== history.rows.find(row => row.id === deleting.id)?.url)); await qc.invalidateQueries({ queryKey: ['image-links'] }); setDeleting(null); toast.success('Image deleted'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not delete image.'); }
    finally { setRemoving(false); }
  }
  const pageCount = Math.max(1, Math.ceil(history.count / IMAGE_PAGE_SIZE));
  return <div className="image-link-page min-w-0 space-y-5 dark:bg-background dark:p-4">
    <PageHeader eyebrow="Media · Admin" title="Image to Link" />
    <section className="space-y-5 border-y border-border bg-glass p-4 sm:p-6">
      <div onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); addFiles(Array.from(event.dataTransfer.files)); }} className="flex min-h-36 items-center justify-center rounded-lg border border-dashed border-border bg-background/50 p-6">
        <Button className="min-h-12 px-7" disabled={busy} onClick={() => input.current?.click()}><ImagePlus className="size-5" />Choose image</Button>
        <input ref={input} type="file" accept="image/*" multiple className="hidden" aria-label="Choose images" onChange={event => { addFiles(Array.from(event.target.files ?? [])); event.target.value = ''; }} />
      </div>
      <div className="grid min-w-0 gap-4 sm:grid-cols-3">
        <div className="space-y-2"><Label htmlFor="image-format">Output format</Label><Select value={format} onValueChange={value => setFormat(value as ImageFormat)} disabled={busy}><SelectTrigger id="image-format" className="min-h-11 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="webp">WebP · 85%</SelectItem><SelectItem value="png">PNG</SelectItem><SelectItem value="jpg">JPG · 85%</SelectItem></SelectContent></Select></div>
        <div className="space-y-2"><Label htmlFor="image-resize">Resize</Label><Select value={resize} onValueChange={setResize} disabled={busy}><SelectTrigger id="image-resize" className="min-h-11 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="original">Original</SelectItem><SelectItem value="1000">Max 1000px</SelectItem><SelectItem value="600">Max 600px</SelectItem><SelectItem value="custom">Custom max width</SelectItem></SelectContent></Select></div>
        {resize === 'custom' && <div className="space-y-2"><Label htmlFor="image-width">Maximum width (px)</Label><Input id="image-width" type="number" min="1" max="16384" value={custom} disabled={busy} onChange={event => setCustom(event.target.value)} className="min-h-11" /></div>}
      </div>
      {drafts.length > 0 && <Button className="min-h-11 w-full sm:w-auto" disabled={busy || !drafts.some(d => d.converted && !d.url)} onClick={() => void upload()}><Upload className="size-4" />{working ? 'Uploading…' : preparing ? 'Preparing images…' : 'Upload images'}</Button>}
    </section>
    {drafts.length > 0 && <div className="grid min-w-0 gap-4 xl:grid-cols-2">{drafts.map(draft => <article key={draft.id} className="min-w-0 space-y-3 rounded-lg border border-border bg-glass p-4">
      <div className="flex min-w-0 items-start gap-2"><h2 className="min-w-0 flex-1 break-all font-medium">{draft.file.name}</h2><Button variant="ghost" className="size-11 shrink-0" disabled={busy} aria-label={`Remove preview ${draft.file.name}`} title="Remove preview" onClick={() => setDrafts(current => current.filter(d => d.id !== draft.id))}><X className="size-4" /></Button></div>
      <div className="grid grid-cols-2 gap-3"><div><p className="mb-2 text-xs text-muted-foreground">Before · {bytes(draft.file.size)}</p><img src={draft.original} alt={`Original ${draft.file.name}`} className="h-36 w-full rounded border border-border object-contain" onError={event => { event.currentTarget.style.visibility = 'hidden'; }} /></div><div><p className="mb-2 text-xs text-muted-foreground">After · {draft.converted ? bytes(draft.converted.blob.size) : '…'}</p>{draft.preview && <img src={draft.preview} alt={`Converted ${draft.file.name}`} className="h-36 w-full rounded border border-border object-contain" />}</div></div>
      {draft.converted && <p className="text-xs text-muted-foreground">{draft.converted.width} × {draft.converted.height} · {draft.converted.format.toUpperCase()} · {draft.file.size >= draft.converted.blob.size ? `${bytes(draft.file.size - draft.converted.blob.size)} saved` : `${bytes(draft.converted.blob.size - draft.file.size)} larger`}</p>}
      {draft.url && <p className="inline-flex rounded-md bg-primary/15 px-2 py-1 text-sm font-semibold text-primary">Done</p>}
      {draft.error && <p role="alert" className="break-words rounded-md border border-destructive bg-destructive/10 p-2 text-destructive">{draft.error}</p>}
      {draft.busy && <div aria-live="polite"><progress aria-label={`Upload progress ${draft.file.name}`} value={draft.progress} max={100} className="h-2 w-full accent-primary" /><p className="text-xs text-muted-foreground">{draft.progress}%</p></div>}
      {draft.url && <LinkControls url={draft.url} copy={copy} open />}
    </article>)}</div>}
    <Panel title="My uploads" actions={<Input aria-label="Search uploads" placeholder="Search uploads" className="min-h-11 w-full sm:w-60" value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} />}>
      {history.rows.length === 0 && <p className="p-6 text-muted-foreground">{search ? 'No matching images.' : 'No uploaded images.'}</p>}
      <div className="grid min-w-0 gap-4 p-4 md:grid-cols-2 2xl:grid-cols-3">{history.rows.map(image => <article key={image.id} className="min-w-0 space-y-3 rounded-lg border border-border bg-background/50 p-3">
        <img src={image.url} alt={image.original_name} loading="lazy" className="h-40 w-full rounded border border-border object-contain" />
        <h3 className="break-all font-medium">{image.original_name}</h3><p className="text-xs text-muted-foreground">{image.format.toUpperCase()} · {bytes(image.size_bytes)} · {image.width} × {image.height} · {new Date(image.created_at).toLocaleDateString()}</p>
        <LinkControls url={image.url} copy={copy} />
        <div className="flex gap-2"><Button asChild variant="outline" className="min-h-11 flex-1"><a href={image.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-4" />Open</a></Button><Button variant="outline" className="min-h-11 flex-1 text-destructive" onClick={() => setDeleting(image)}><Trash2 className="size-4" />Delete</Button></div>
      </article>)}</div>
      <div className="flex items-center justify-between gap-3 border-t border-border p-4"><Button variant="outline" className="size-11" aria-label="Previous page" title="Previous page" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft className="size-4" /></Button><span className="text-xs text-muted-foreground">Page {page + 1} of {pageCount} · {history.count} images</span><Button variant="outline" className="size-11" aria-label="Next page" title="Next page" disabled={page + 1 >= pageCount} onClick={() => setPage(p => p + 1)}><ChevronRight className="size-4" /></Button></div>
    </Panel>
    <Dialog open={!!deleting} onOpenChange={open => { if (!open && !removing) setDeleting(null); }}><DialogContent><DialogHeader><DialogTitle>Delete image?</DialogTitle></DialogHeader><p className="break-all">{deleting?.original_name}</p><p className="text-muted-foreground">Its public link will stop working.</p><DialogFooter><Button variant="outline" className="min-h-11" disabled={removing} onClick={() => setDeleting(null)}>Cancel</Button><Button variant="destructive" className="min-h-11" disabled={removing} onClick={() => void remove()}><Trash2 className="size-4" />{removing ? 'Deleting…' : 'Delete image'}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
function LinkControls({ url, copy, open = false }: { url: string; copy: (value: string) => Promise<void>; open?: boolean }) {
  return <div className="min-w-0 space-y-2">
    <textarea aria-label="Public image link" readOnly value={url} rows={2} className="block min-h-11 w-full min-w-0 resize-none break-all rounded-md border border-input bg-background px-3 py-2 font-mono text-xs" onFocus={event => event.target.select()} />
    <div className={`grid grid-cols-1 gap-2 ${open ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
      <Button className="min-h-11" onClick={() => void copy(url)}><Copy className="size-4" />Copy link</Button>
      <Button variant="outline" className="min-h-11" onClick={() => void copy(`tvg-logo="${url}"`)}><Copy className="size-4" />Copy as tvg-logo</Button>
      {open && <Button asChild variant="outline" className="min-h-11"><a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-4" />Open</a></Button>}
    </div>
  </div>;
}
