import { createFileRoute, redirect } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { queryOptions, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Copy, Check, Upload, Trash2, ExternalLink, ChevronLeft, ChevronRight, ImagePlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { convertImage, copyImageLink, validateImage, DEFAULT_IMAGE_FORMAT, DEFAULT_MAX_WIDTH, type ConvertedImage, type ImageFormat, type JpgBackground } from '@/lib/image-conversion';
import { deleteImageLink, IMAGE_PAGE_SIZE, imageShortUrl, listImageLinks, requireImageAdmin, uploadImageLink } from '@/lib/image-links';

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

type Draft = { id: number; file: File; original: string; preview?: string | undefined; converted?: ConvertedImage | undefined; error?: string | undefined; progress: number; url?: string; savedId?: string; savedPath?: string; failed?: boolean; busy: boolean };
const bytes = (value: number) => value >= 1024 ** 2 ? `${(value / 1024 ** 2).toFixed(2)} MB` : `${Math.max(0.1, value / 1024).toFixed(value < 10240 ? 1 : 0)} KB`;
const ctl = 'h-10 rounded-lg text-sm';
const shortLink = (url: string) => url.split('/').pop() ?? url;

function ImageToLink() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const { data: history } = useSuspenseQuery(historyOptions(search, page));
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [format, setFormat] = useState<ImageFormat>(DEFAULT_IMAGE_FORMAT);
  const [background, setBackground] = useState<JpgBackground>('white');
  const [resize, setResize] = useState(String(DEFAULT_MAX_WIDTH));
  const [working, setWorking] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [deleting, setDeleting] = useState<{ id: string; path: string; original_name: string } | null>(null);
  const [removing, setRemoving] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const ids = useRef(0);
  const urls = useRef(new Set<string>());
  const maxWidth = resize === 'original' ? null : Number(resize);
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
          const converted = await convertImage(draft.file, format, maxWidth, background);
          if (cancelled) return;
          const preview = URL.createObjectURL(converted.blob); urls.current.add(preview);
          setDrafts(current => current.map(d => { if (d.id !== draft.id) return d; if (d.preview) { URL.revokeObjectURL(d.preview); urls.current.delete(d.preview); } return { ...d, converted, preview, error: undefined }; }));
        } catch (error) { if (!cancelled) setDrafts(current => current.map(d => d.id === draft.id ? { ...d, converted: undefined, error: error instanceof Error ? error.message : 'Conversion failed.' } : d)); }
      }
      if (!cancelled) setPreparing(false);
    })();
    return () => { cancelled = true; };
  }, [pendingKey, format, maxWidth, background, working]);
  useEffect(() => () => { for (const url of urls.current) URL.revokeObjectURL(url); }, []);
  useEffect(() => {
    const paste = (event: ClipboardEvent) => { const files = Array.from(event.clipboardData?.files ?? []).filter(f => f.type.startsWith('image/')); if (files.length) { event.preventDefault(); addFiles(files); } };
    document.addEventListener('paste', paste);
    return () => document.removeEventListener('paste', paste);
  }, [busy]);
  async function copy(text: string) { try { await copyImageLink(text); toast.success('Link copied'); return true; } catch (error) { toast.error(error instanceof Error ? error.message : 'Copy failed.'); return false; } }
  // Converted images are saved automatically so the link and copy buttons appear without an extra click.
  useEffect(() => {
    if (!preparing && !working && drafts.some(d => d.converted && !d.url && !d.failed && !d.busy)) void upload(false);
  }, [preparing, working, drafts]);
  async function upload(retry = true) {
    setWorking(true);
    for (const draft of drafts.filter(d => d.converted && !d.url && (retry || !d.failed))) {
      if (!draft.converted) continue;
      setDrafts(current => current.map(d => d.id === draft.id ? { ...d, busy: true, failed: false, error: undefined } : d));
      try {
        const saved = await uploadImageLink(draft.file, draft.converted, progress => setDrafts(current => current.map(d => d.id === draft.id ? { ...d, progress } : d)));
        setDrafts(current => current.map(d => d.id === draft.id ? { ...d, busy: false, url: imageShortUrl(saved.path), savedId: saved.id, savedPath: saved.path } : d));
      } catch (error) {
        console.error('Image upload failed', draft.file.name, error);
        const message = error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String((error as { message: unknown }).message) : 'Upload failed.';
        setDrafts(current => current.map(d => d.id === draft.id ? { ...d, busy: false, failed: true, error: message } : d));
        toast.error(`${draft.file.name}: ${message}`);
      }
    }
    await qc.invalidateQueries({ queryKey: ['image-links'] }); setWorking(false);
  }
  async function remove() {
    if (!deleting) return;
    setRemoving(true);
    try { await deleteImageLink(deleting.id, deleting.path); setDrafts(current => current.filter(d => d.savedId !== deleting.id)); await qc.invalidateQueries({ queryKey: ['image-links'] }); setDeleting(null); toast.success('Image deleted'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not delete image.'); }
    finally { setRemoving(false); }
  }
  const pageCount = Math.max(1, Math.ceil(history.count / IMAGE_PAGE_SIZE));
  return <div className="image-link-page mx-auto w-full min-w-0 max-w-[880px] space-y-4 text-sm">
    <header><h1 className="text-xl font-semibold">Image to Link</h1><p className="text-muted-foreground">Convert posters and channel logos into permanent public links.</p></header>
    <section className="space-y-3 rounded-lg border border-border bg-card p-3 sm:p-4">
      <div onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); addFiles(Array.from(event.dataTransfer.files)); }} className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 p-4 text-center">
        <ImagePlus className="size-5 text-muted-foreground" />
        <p className="text-muted-foreground">Drop images here or browse</p>
        <Button size="sm" className={ctl} disabled={busy} onClick={() => input.current?.click()}>Choose images</Button>
        <input ref={input} type="file" accept="image/*" multiple className="hidden" aria-label="Choose images" onChange={event => { addFiles(Array.from(event.target.files ?? [])); event.target.value = ''; }} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={format} onValueChange={value => setFormat(value as ImageFormat)} disabled={busy}><SelectTrigger aria-label="Output format" className={`${ctl} w-full sm:w-[310px]`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="jpg">JPG (best compatibility, recommended)</SelectItem><SelectItem value="png">PNG (transparent logos)</SelectItem></SelectContent></Select>
        {format === 'jpg' && <Select value={background} onValueChange={value => setBackground(value as JpgBackground)} disabled={busy}><SelectTrigger aria-label="Background" className={`${ctl} w-[calc(50%-4px)] sm:w-[160px]`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="white">Background: White</SelectItem><SelectItem value="black">Background: Black</SelectItem></SelectContent></Select>}
        <Select value={resize} onValueChange={setResize} disabled={busy}><SelectTrigger aria-label="Resize" className={`${ctl} w-[calc(50%-4px)] sm:w-[130px]`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="original">Original</SelectItem><SelectItem value="1000">1000px</SelectItem><SelectItem value="600">600px</SelectItem><SelectItem value="400">400px</SelectItem></SelectContent></Select>
        <Button className={`${ctl} w-full sm:ml-auto sm:w-auto`} disabled={busy || !drafts.some(d => d.converted && !d.url)} onClick={() => void upload(true)}><Upload className="size-4" />{working ? 'Uploading…' : preparing ? 'Preparing…' : drafts.some(d => d.failed) ? 'Retry upload' : 'Upload'}</Button>
      </div>
    </section>
    {drafts.length > 0 && <ul className="space-y-2">{drafts.map(draft => {
      const status = draft.error ? 'Error' : draft.url ? 'Done' : draft.busy ? 'Uploading' : 'Preparing';
      const tone = status === 'Error' ? 'bg-destructive/10 text-destructive' : status === 'Done' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground';
      return <li key={draft.id} className="min-w-0 space-y-2 rounded-lg border border-border bg-card p-3">
        <div className="flex min-w-0 items-center gap-3">
          <Popover><PopoverTrigger asChild><button type="button" aria-label={`Compare ${draft.file.name}`} title="Compare" className="size-16 shrink-0 overflow-hidden rounded-md border border-border bg-muted"><img src={draft.preview ?? draft.original} alt="" className="size-full object-cover" /></button></PopoverTrigger>
            <PopoverContent className="w-80"><div className="grid grid-cols-2 gap-2 text-xs"><div><p className="mb-1 text-muted-foreground">Before · {bytes(draft.file.size)}</p><img src={draft.original} alt={`Original ${draft.file.name}`} className="h-32 w-full rounded border border-border object-contain" /></div><div><p className="mb-1 text-muted-foreground">After · {draft.converted ? bytes(draft.converted.blob.size) : '…'}</p>{draft.preview && <img src={draft.preview} alt={`Converted ${draft.file.name}`} className="h-32 w-full rounded border border-border object-contain" />}</div></div></PopoverContent></Popover>
          <div className="min-w-0 flex-1"><p className="truncate font-medium">{draft.file.name}</p><p className="truncate text-xs text-muted-foreground">Before {bytes(draft.file.size)}{draft.converted && <> → After {bytes(draft.converted.blob.size)} · {draft.converted.width}x{draft.converted.height} · {draft.converted.format.toUpperCase()}</>}</p></div>
          <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${tone}`}>{status}{draft.busy ? ` ${draft.progress}%` : ''}</span>
          <Button variant="ghost" size="icon" className="size-10 shrink-0" disabled={busy} aria-label={`Remove preview ${draft.file.name}`} title="Remove" onClick={() => setDrafts(current => current.filter(d => d.id !== draft.id))}><X className="size-4" /></Button>
        </div>
        {draft.busy && <progress aria-label={`Upload progress ${draft.file.name}`} value={draft.progress} max={100} className="h-1 w-full accent-primary" />}
        {draft.error && <p role="alert" className="break-words text-xs text-destructive">{draft.error}</p>}
        {draft.url && <LinkRow url={draft.url} copy={copy} onDelete={draft.savedId && draft.savedPath ? () => setDeleting({ id: draft.savedId!, path: draft.savedPath!, original_name: draft.file.name }) : undefined} />}
      </li>;
    })}</ul>}
    <section className="min-w-0 rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3"><h2 className="font-semibold">My uploads</h2><Input aria-label="Search uploads" placeholder="Search uploads" className={`${ctl} w-full sm:w-56`} value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} /></div>
      {history.rows.length === 0 ? <p className="p-4 text-muted-foreground">{search ? 'No matching images.' : 'No uploaded images.'}</p> : <>
        <table className="hidden w-full table-fixed md:table">
          <thead className="text-left text-xs text-muted-foreground"><tr className="border-b border-border"><th className="w-14 p-2 pl-3" /><th className="p-2">Link</th><th className="w-16 p-2">Format</th><th className="w-20 p-2">Size</th><th className="w-24 p-2">Date</th><th className="w-[168px] p-2 pr-3 text-right">Actions</th></tr></thead>
          <tbody>{history.rows.map(image => <tr key={image.id} className="border-b border-border last:border-0">
            <td className="p-2 pl-3"><img src={image.url} alt={image.original_name} loading="lazy" className="size-10 rounded border border-border object-cover" /></td>
            <td className="min-w-0 p-2"><p className="truncate font-medium">{image.original_name}</p><p className="truncate font-mono text-xs text-muted-foreground" title={imageShortUrl(image.path)}>{shortLink(image.url)}</p></td>
            <td className="p-2 text-xs">{image.format.toUpperCase()}</td><td className="p-2 text-xs">{bytes(image.size_bytes)}</td><td className="p-2 text-xs">{new Date(image.created_at).toLocaleDateString()}</td>
            <td className="p-2 pr-3"><RowActions url={imageShortUrl(image.path)} copy={copy} onDelete={() => setDeleting(image)} /></td>
          </tr>)}</tbody>
        </table>
        <ul className="md:hidden">{history.rows.map(image => <li key={image.id} className="flex min-w-0 items-center gap-3 border-b border-border p-3 last:border-0">
          <img src={image.url} alt={image.original_name} loading="lazy" className="size-10 shrink-0 rounded border border-border object-cover" />
          <div className="min-w-0 flex-1"><p className="truncate font-medium">{image.original_name}</p><p className="truncate text-xs text-muted-foreground">{image.format.toUpperCase()} · {bytes(image.size_bytes)} · {new Date(image.created_at).toLocaleDateString()}</p></div>
          <RowActions url={imageShortUrl(image.path)} copy={copy} onDelete={() => setDeleting(image)} compact />
        </li>)}</ul>
      </>}
      <div className="flex items-center justify-between gap-3 border-t border-border p-2"><Button variant="outline" size="icon" className="size-10" aria-label="Previous page" title="Previous page" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft className="size-4" /></Button><span className="text-xs text-muted-foreground">Page {page + 1} of {pageCount} · {history.count} images</span><Button variant="outline" size="icon" className="size-10" aria-label="Next page" title="Next page" disabled={page + 1 >= pageCount} onClick={() => setPage(p => p + 1)}><ChevronRight className="size-4" /></Button></div>
    </section>
    <Dialog open={!!deleting} onOpenChange={open => { if (!open && !removing) setDeleting(null); }}><DialogContent><DialogHeader><DialogTitle>Delete image?</DialogTitle></DialogHeader><p className="break-all">{deleting?.original_name}</p><p className="text-muted-foreground">Its public link will stop working.</p><DialogFooter><Button variant="outline" className={ctl} disabled={removing} onClick={() => setDeleting(null)}>Cancel</Button><Button variant="destructive" className={ctl} disabled={removing} onClick={() => void remove()}><Trash2 className="size-4" />{removing ? 'Deleting…' : 'Delete image'}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
type CopyFn = (value: string) => Promise<boolean>;
function useCopied(copy: CopyFn) {
  const [done, setDone] = useState(false);
  return [done, async (value: string) => { if (await copy(value)) { setDone(true); setTimeout(() => setDone(false), 1500); } }] as const;
}
function LinkRow({ url, copy, onDelete }: { url: string; copy: CopyFn; onDelete?: (() => void) | undefined }) {
  const [copied, doCopy] = useCopied(copy);
  const [logoCopied, doLogo] = useCopied(copy);
  return <div className="flex min-w-0 flex-wrap items-center gap-2">
    <Input aria-label="Public image link" readOnly value={url} className={`${ctl} min-w-0 flex-[1_1_220px] truncate font-mono text-xs`} onFocus={event => event.target.select()} />
    <div className="flex w-full gap-2 sm:w-auto">
      <Button className={`${ctl} flex-1 sm:flex-none`} onClick={() => void doCopy(url)}>{copied ? <Check className="size-4" /> : <Copy className="size-4" />}Copy link</Button>
      <Button variant="secondary" className={`${ctl} min-w-0 px-3`} onClick={() => void doLogo(`tvg-logo="${url}"`)}>{logoCopied ? <Check className="size-4" /> : <Copy className="size-4" />}<span className="hidden sm:inline">Copy</span> tvg-logo</Button>
      <Button asChild variant="outline" size="icon" className="size-10 shrink-0"><a href={url} target="_blank" rel="noopener noreferrer" aria-label="Open" title="Open"><ExternalLink className="size-4" /></a></Button>
      {onDelete && <Button variant="outline" size="icon" className="size-10 shrink-0 hover:border-destructive hover:text-destructive" aria-label="Delete" title="Delete" onClick={onDelete}><Trash2 className="size-4" /></Button>}
    </div>
  </div>;
}
function RowActions({ url, copy, onDelete, compact = false }: { url: string; copy: CopyFn; onDelete: () => void; compact?: boolean }) {
  const [copied, doCopy] = useCopied(copy);
  return <div className="flex shrink-0 justify-end gap-1">
    <Button size={compact ? 'icon' : 'sm'} className={compact ? 'size-10' : 'h-9 rounded-lg'} aria-label="Copy link" title="Copy link" onClick={() => void doCopy(url)}>{copied ? <Check className="size-4" /> : <Copy className="size-4" />}{!compact && 'Copy'}</Button>
    {!compact && <Button variant="ghost" size="icon" className="size-9" aria-label="Copy as tvg-logo" title="Copy as tvg-logo" onClick={() => void copy(`tvg-logo="${url}"`)}><span className="text-[10px] font-semibold">tvg</span></Button>}
    <Button asChild variant="ghost" size="icon" className={compact ? 'size-10' : 'size-9'}><a href={url} target="_blank" rel="noopener noreferrer" aria-label="Open" title="Open"><ExternalLink className="size-4" /></a></Button>
    <Button variant="ghost" size="icon" className={`${compact ? 'size-10' : 'size-9'} hover:text-destructive`} aria-label="Delete" title="Delete" onClick={onDelete}><Trash2 className="size-4" /></Button>
  </div>;
}
