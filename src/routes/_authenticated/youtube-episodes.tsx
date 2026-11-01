import { createFileRoute } from '@tanstack/react-router';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState, type FormEvent } from 'react';
import { Plus, Pencil, Trash2, Play, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader, inputCls } from '@/components/panel';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { managedContentOptions, existingSeriesOptions } from '@/lib/content-query';
import { addSeason, deleteContent, getYoutubeMetadata, saveEpisode, saveSeries } from '@/lib/content.functions';
import { episodeCode, youtubeId } from '@/lib/youtube';
import { YoutubePlayer } from '@/components/youtube-player';
import { supabase } from '@/integrations/supabase/client';
import { useMe } from '@/hooks/use-me';
import { EpisodePoster } from '@/components/episode-poster';

export const Route = createFileRoute('/_authenticated/youtube-episodes')({
  head: () => ({ meta: [{ title: 'YouTube Episode Manager — Kurdistan IPTV' }, { name: 'description', content: 'Manage owned YouTube series, seasons and episodes in Kurdistan IPTV.' }, { property: 'og:title', content: 'YouTube Episode Manager — Kurdistan IPTV' }, { property: 'og:description', content: 'Manage owned YouTube series, seasons and episodes in Kurdistan IPTV.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(managedContentOptions), context.queryClient.ensureQueryData(existingSeriesOptions)]),
  component: EpisodeManager,
});

type EpisodeForm = { id?: string; season_id: string; episode_number: number; title: string; original_url: string; poster_url: string; description: string; release_date: string; published: boolean; language_label?: string };
type SeriesForm = { id?: string; title: string; category: string; poster_url: string; description: string; source_identity?: string | undefined };

function EpisodeManager() {
  const { data } = useSuspenseQuery(managedContentOptions);
  const { data: existing } = useSuspenseQuery(existingSeriesOptions);
  const { data: me } = useMe();
  const qc = useQueryClient();
  const saveSeriesFn = useServerFn(saveSeries), seasonFn = useServerFn(addSeason), saveFn = useServerFn(saveEpisode), deleteFn = useServerFn(deleteContent), metadataFn = useServerFn(getYoutubeMetadata);
  const [selected, setSelected] = useState('');
  const series = data.series.find(s => s.id === selected) ?? data.series[0];
  const seasons = data.seasons.filter(s => s.series_id === series?.id);
  const [seasonFilter, setSeasonFilter] = useState('all');
  const episodes = data.episodes.filter(e => e.series_id === series?.id && (seasonFilter === 'all' || e.season_id === seasonFilter));
  const [form, setForm] = useState<EpisodeForm | null>(null);
  const [seriesForm, setSeriesForm] = useState<SeriesForm | null>(null);
  const [seasonOpen, setSeasonOpen] = useState(false), [seasonNumber, setSeasonNumber] = useState(1);
  const [preview, setPreview] = useState<{ id: string; title: string } | null>(null);
  const [remove, setRemove] = useState<{ type: 'episode' | 'series' | 'season'; id: string; title: string } | null>(null);
  const [busy, setBusy] = useState(false), [metadataBusy, setMetadataBusy] = useState(false);
  async function perform(work: () => Promise<unknown>, close: () => void) {
    setBusy(true);
    try { await work(); await qc.invalidateQueries({ queryKey: ['managed-content'] }); close(); toast.success('Saved'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Could not save'); }
    finally { setBusy(false); }
  }
  function newEpisode() {
    const season = seasons.find(s => s.id === seasonFilter) ?? seasons[0];
    if (!season) { setSeasonOpen(true); return; }
    const next = Math.max(0, ...data.episodes.filter(e => e.season_id === season.id).map(e => e.episode_number)) + 1;
    setForm({ season_id: season.id, episode_number: next, title: '', original_url: '', poster_url: '', description: '', release_date: '', published: false });
  }
  async function metadata() {
    if (!form || !youtubeId(form.original_url)) return;
    const requested = form.original_url;
    setMetadataBusy(true);
    try {
      const result = await metadataFn({ data: { url: requested } });
      if (result.error) toast.info(result.error);
      else setForm(current => current?.original_url === requested ? { ...current, title: current.title || result.title || '', poster_url: current.poster_url || result.poster || '' } : current);
    } catch { toast.info('Metadata unavailable. Enter the details manually.'); }
    finally { setMetadataBusy(false); }
  }
  async function upload(file: File | undefined, destination: 'episode' | 'series') {
    if (!file || !me?.id) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { toast.error('Choose a JPG, PNG or WebP image under 5 MB.'); return; }
    setBusy(true);
    try {
      const extension = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp';
      const path = `${me.id}/${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage.from('episode-posters').upload(path, file, { contentType: file.type });
      if (error) throw error;
      // Store the canonical storage locator; server reads replace it with a short-lived signed URL.
      const value = supabase.storage.from('episode-posters').getPublicUrl(path).data.publicUrl;
      if (destination === 'episode') setForm(v => v ? { ...v, poster_url: value } : v);
      else setSeriesForm(v => v ? { ...v, poster_url: value } : v);
    } catch { toast.error('Poster upload failed.'); }
    finally { setBusy(false); }
  }
  const selectedSeason = seasons.find(s => s.id === form?.season_id);
  return <>
    <PageHeader eyebrow="Content · YouTube" title="YouTube Episode Manager" actions={<><Button variant="outline" onClick={() => setSeriesForm({ title: '', category: 'YouTube', poster_url: '', description: '' })}><Plus className="size-4" />New series</Button><Button onClick={newEpisode} disabled={!series}><Plus className="size-4" />Add episode</Button></>} />
    <div className="flex flex-wrap items-end gap-4 border-y border-border py-4">
      <label className="flex min-w-0 basis-full flex-col gap-2 text-sm sm:flex-1 sm:basis-64">Series<select className={`${inputCls} w-full py-2`} value={series?.id ?? ''} onChange={e => { setSelected(e.target.value); setSeasonFilter('all'); }}>{data.series.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
      <label className="flex flex-col gap-2 text-sm">Season<select className={`${inputCls} py-2`} value={seasonFilter} onChange={e => setSeasonFilter(e.target.value)}><option value="all">All seasons</option>{seasons.map(s => <option key={s.id} value={s.id}>Season {String(s.season_number).padStart(2, '0')}</option>)}</select></label>
      <Button variant="outline" disabled={!series} onClick={() => { setSeasonNumber(Math.max(0, ...seasons.map(s => s.season_number)) + 1); setSeasonOpen(true); }}><Plus className="size-4" />Season</Button>
      <Button variant="ghost" size="icon" aria-label="Edit series" title="Edit series" disabled={!series} onClick={() => { if (series) setSeriesForm({ ...series, source_identity: series.source_identity ?? undefined, poster_url: series.poster_url ?? '' }); }}><Pencil className="size-4" /></Button>
      <Button variant="ghost" size="icon" aria-label="Delete series" title="Delete series" disabled={!series} onClick={() => { if (series) setRemove({ type: 'series', id: series.id, title: series.title }); }}><Trash2 className="size-4 text-destructive" /></Button>
      {seasonFilter !== 'all' && <Button variant="ghost" size="icon" aria-label="Delete season" title="Delete season" onClick={() => setRemove({ type: 'season', id: seasonFilter, title: 'this season' })}><Trash2 className="size-4 text-destructive" /></Button>}
    </div>
    {series && <div><h2 className="font-display text-xl font-semibold">{series.title}</h2><p className="mt-1 text-muted-foreground">{series.description || series.category} · {episodes.length} episodes</p></div>}
    {!data.series.length && <p className="py-12 text-center text-muted-foreground">No managed series yet.</p>}
    {series && !episodes.length && <p className="py-12 text-center text-muted-foreground">No episodes in this season.</p>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{episodes.map(e => {
      const poster = e.display_poster ?? series?.display_poster;
      return <article key={e.id} className="overflow-hidden rounded-lg border border-border bg-card">
        <EpisodePoster url={poster} title={e.title} />
        {e.language_label && <p className="px-4 pt-3 text-sm text-muted-foreground">{e.language_label}</p>}
        <div className="space-y-3 p-4"><div className="flex items-center justify-between gap-3"><span className="font-mono text-primary">{episodeCode(e.season_number, e.episode_number)}</span><span className={e.published ? 'text-good' : 'text-muted-foreground'}>{e.published ? 'Published' : 'Unpublished'}</span></div><h3 className="break-words font-semibold">{e.title}</h3>{e.release_date && <p className="text-xs text-muted-foreground">{e.release_date}</p>}<div className="flex gap-2"><Button variant="outline" onClick={() => setPreview({ id: e.youtube_video_id, title: e.title })}><Play className="size-4" />Preview</Button><Button variant="ghost" size="icon" aria-label={`Edit ${e.title}`} title="Edit episode" onClick={() => setForm({ ...e, poster_url: e.poster_url ?? '', release_date: e.release_date ?? '' })}><Pencil className="size-4" /></Button><Button variant="ghost" size="icon" aria-label={`Delete ${e.title}`} title="Delete episode" onClick={() => setRemove({ type: 'episode', id: e.id, title: e.title })}><Trash2 className="size-4 text-destructive" /></Button></div></div>
      </article>;
    })}</div>
    <Dialog open={!!form} onOpenChange={v => { if (!v) setForm(null); }}><DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>{form?.id ? 'Edit episode' : 'Add episode'} {form && selectedSeason ? episodeCode(selectedSeason.season_number, form.episode_number) : ''}</DialogTitle><DialogDescription>{series?.title}</DialogDescription></DialogHeader>{form && <form className="grid gap-4" onSubmit={(e: FormEvent) => { e.preventDefault(); void perform(() => saveFn({ data: form }), () => setForm(null)); }}>
      <div className="grid grid-cols-2 gap-4"><label className="grid gap-2">Season<select disabled={!!form.id} className={inputCls} value={form.season_id} onChange={e => setForm({ ...form, season_id: e.target.value })}>{seasons.map(s => <option key={s.id} value={s.id}>Season {s.season_number}</option>)}</select></label><label className="grid gap-2">Episode number<input required type="number" min="1" max="9999" className={inputCls} value={form.episode_number} onChange={e => setForm({ ...form, episode_number: Number(e.target.value) })} /></label></div>
      <label className="grid gap-2">YouTube URL<input required type="url" className={inputCls} value={form.original_url} onBlur={() => void metadata()} onChange={e => setForm({ ...form, original_url: e.target.value })} /></label>{form.original_url && !youtubeId(form.original_url) && <p role="alert" className="text-destructive">Enter a supported HTTPS YouTube watch, short, embed or live URL.</p>}
      <Button type="button" variant="outline" disabled={!youtubeId(form.original_url) || metadataBusy} onClick={() => void metadata()}>{metadataBusy ? 'Loading metadata…' : 'Get video details'}</Button>
      <label className="grid gap-2">Episode title<input required maxLength={300} className={inputCls} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label>
      <label className="grid gap-2">Language / dubbing<input maxLength={200} className={inputCls} value={form.language_label ?? ''} onChange={e => setForm({ ...form, language_label: e.target.value })} /></label>
      <label className="grid gap-2">Poster URL<input type="url" className={inputCls} value={form.poster_url} onChange={e => setForm({ ...form, poster_url: e.target.value })} /></label><label className="flex items-center gap-2 text-sm"><Upload className="size-4" />Upload poster<input aria-label="Upload episode poster" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => void upload(e.target.files?.[0], 'episode')} className="min-w-0 text-xs" /></label>
      <label className="grid gap-2">Description<textarea className={inputCls} rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label><label className="grid gap-2">Release date<input type="date" className={inputCls} value={form.release_date} onChange={e => setForm({ ...form, release_date: e.target.value })} /></label><label className="flex items-center gap-2"><input type="checkbox" checked={form.published} onChange={e => setForm({ ...form, published: e.target.checked })} />Published</label>
      <Button disabled={busy || !youtubeId(form.original_url)} type="submit">{busy ? 'Saving…' : form.id ? 'Save episode' : 'Add episode'}</Button>
    </form>}</DialogContent></Dialog>
    <Dialog open={!!seriesForm} onOpenChange={v => { if (!v) setSeriesForm(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{seriesForm?.id ? 'Edit series' : 'New series'}</DialogTitle><DialogDescription>Series details</DialogDescription></DialogHeader>{seriesForm && <form className="grid gap-4" onSubmit={e => { e.preventDefault(); void perform(async () => { const saved = await saveSeriesFn({ data: seriesForm }); if (saved) setSelected(saved.id); }, () => setSeriesForm(null)); }}>
      {!seriesForm.id && <label className="grid gap-2">Existing GitHub series<select className={inputCls} defaultValue="" onChange={e => { const value = existing[Number(e.target.value)]; if (value) setSeriesForm({ title: value.title, category: value.category, poster_url: value.poster_url?.startsWith('https://') ? value.poster_url : '', description: '', source_identity: value.source_identity }); }}><option value="">Create a new series</option>{existing.map((s, i) => <option key={s.source_identity} value={i}>{s.title}</option>)}</select></label>}
      <label className="grid gap-2">Series name<input required className={inputCls} value={seriesForm.title} onChange={e => setSeriesForm({ ...seriesForm, title: e.target.value })} /></label><label className="grid gap-2">Category<input required className={inputCls} value={seriesForm.category} onChange={e => setSeriesForm({ ...seriesForm, category: e.target.value })} /></label><label className="grid gap-2">Series poster URL<input type="url" className={inputCls} value={seriesForm.poster_url} onChange={e => setSeriesForm({ ...seriesForm, poster_url: e.target.value })} /></label><label className="flex flex-wrap items-center gap-2"><Upload className="size-4" />Upload poster<input aria-label="Upload series poster" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => void upload(e.target.files?.[0], 'series')} className="min-w-0 text-xs" /></label><label className="grid gap-2">Description<textarea className={inputCls} value={seriesForm.description} onChange={e => setSeriesForm({ ...seriesForm, description: e.target.value })} /></label><Button type="submit" disabled={busy}>Save series</Button>
    </form>}</DialogContent></Dialog>
    <Dialog open={seasonOpen} onOpenChange={setSeasonOpen}><DialogContent><DialogHeader><DialogTitle>Add season</DialogTitle><DialogDescription>{series?.title}</DialogDescription></DialogHeader><form className="grid gap-4" onSubmit={e => { e.preventDefault(); if (series) void perform(() => seasonFn({ data: { series_id: series.id, season_number: seasonNumber } }), () => setSeasonOpen(false)); }}><label className="grid gap-2">Season number<input type="number" required min="1" max="999" className={inputCls} value={seasonNumber} onChange={e => setSeasonNumber(Number(e.target.value))} /></label><Button type="submit" disabled={busy || !series}>Add season</Button></form></DialogContent></Dialog>
    <Dialog open={!!remove} onOpenChange={v => { if (!v) setRemove(null); }}><DialogContent><DialogHeader><DialogTitle>Delete {remove?.title}?</DialogTitle><DialogDescription>{remove?.type === 'episode' ? 'This episode will be permanently removed.' : 'This also permanently removes all episodes inside it.'}</DialogDescription></DialogHeader><div className="flex justify-end gap-3"><Button variant="outline" onClick={() => setRemove(null)}>Cancel</Button><Button variant="destructive" disabled={busy} onClick={() => { if (remove) void perform(() => deleteFn({ data: { type: remove.type, id: remove.id } }), () => setRemove(null)); }}>Delete</Button></div></DialogContent></Dialog>
    <Dialog open={!!preview} onOpenChange={v => { if (!v) setPreview(null); }}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>{preview?.title}</DialogTitle><DialogDescription>YouTube</DialogDescription></DialogHeader>{preview && <YoutubePlayer videoId={preview.id} title={preview.title} />}</DialogContent></Dialog>
  </>;
}