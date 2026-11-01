import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Play, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { inputCls } from '@/components/panel';
import { useMe } from '@/hooks/use-me';
import { useResellers } from '@/lib/queries';
import { managedContentOptions, existingSeriesOptions } from '@/lib/content-query';
import { addProviderEpisode } from '@/lib/content.functions';
import { structuredEpisodeTitle } from '@/lib/youtube';
import { EpisodePoster } from './episode-poster';
import { YoutubePlayer } from './youtube-player';
import { mergeProviderCatalog } from '@/lib/provider-catalog';

const blank = { english_name: '', original_name: '', tmdb_id: '', season_number: 1, episode_number: 1, language_label: 'KURDISH-دۆبلاژ', original_url: '', poster_url: '' };
export function ProviderYoutubeEpisodes({ providerKey, providerName }: { providerKey: string; providerName: string }) {
  const { data: me } = useMe();
  const { data: resellers = [] } = useResellers();
  const { data } = useQuery(managedContentOptions);
  const { data: existing = [] } = useQuery(existingSeriesOptions);
  const qc = useQueryClient(), add = useServerFn(addProviderEpisode);
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [owner, setOwner] = useState('');
  const [form, setForm] = useState(blank), [language, setLanguage] = useState('all');
  const [preview, setPreview] = useState<{ title: string; id: string } | null>(null);
  const [selectedSeries, setSelectedSeries] = useState('');
  const targetOwner = me?.role === 'admin' ? owner || me.id : me?.id;
  const managedSeries = data?.series.filter(s => s.provider_key === providerKey && s.owner_id === targetOwner) ?? [];
  const managedEpisodes = data?.episodes.filter(e => managedSeries.some(s => s.id === e.series_id)) ?? [];
  const combined = mergeProviderCatalog(providerKey === 'github' ? existing : [], { series: managedSeries.map(s => ({ ...s, poster_url: s.display_poster })), seasons: data?.seasons.filter(s => managedSeries.some(parent => parent.id === s.series_id)) ?? [], episodes: managedEpisodes.map(e => ({ ...e, poster_url: e.display_poster, playback: { source_type: 'youtube', youtube_video_id: e.youtube_video_id, embed_url: `https://www.youtube.com/embed/${e.youtube_video_id}`, original_url: e.original_url } })) });
  const all = combined.episodes;
  const activeSeries = combined.series.some(s => s.id === selectedSeries) ? selectedSeries : managedSeries[0]?.id ?? combined.series[0]?.id;
  const shown = all.filter(e => e.series_id === activeSeries && (language === 'all' || e.language_label === language));
  const title = form.english_name && form.original_name && form.tmdb_id ? structuredEpisodeTitle(form.english_name, form.original_name, Number(form.tmdb_id), form.season_number, form.episode_number) : '';
  return <section className="space-y-4 border-y border-border py-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-xl font-semibold">Series catalogue · {providerName}</h2><Button onClick={() => setOpen(true)}><Plus className="size-4" />Add YouTube Episode</Button></div>
    <div className="flex flex-wrap gap-4">
      {me?.role === 'admin' && <label className="grid gap-2 text-sm">Content owner<select aria-label="Content owner" className={inputCls} value={targetOwner ?? ''} onChange={e => { setOwner(e.target.value); setSelectedSeries(''); }}><option value={me.id}>My customer lines</option>{resellers.map(r => <option key={r.id} value={r.id}>{r.display_name || r.email}</option>)}</select></label>}
      <label className="grid min-w-0 flex-1 gap-2 text-sm">Series<select aria-label="Provider series" className={`${inputCls} w-full`} value={activeSeries ?? ''} onChange={e => setSelectedSeries(e.target.value)}>{combined.series.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
    </div>
    <label className="flex flex-wrap items-center gap-3 text-sm">Language<select className={inputCls} value={language} onChange={e => setLanguage(e.target.value)}><option value="all">All languages</option>{[...new Set(all.map(e => e.language_label).filter(Boolean))].map(l => <option key={l}>{l}</option>)}</select></label>
    {!shown.length && <p className="text-muted-foreground">No episodes.</p>}
    <div className="grid max-h-[640px] gap-4 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">{shown.map(e => <article key={e.id} className="overflow-hidden rounded-lg border border-border bg-card"><EpisodePoster url={e.poster_url} title={e.title} /><div className="space-y-3 p-4"><h3 className="break-words font-semibold">{e.title}</h3><p className="text-sm text-muted-foreground">{e.language_label} · {e.playback.source_type === 'm3u' ? 'M3U' : 'YouTube'}</p>{e.playback.source_type === 'youtube' && <Button variant="outline" onClick={() => { if (e.playback.source_type === 'youtube') setPreview({ title: e.title, id: e.playback.youtube_video_id }); }}><Play className="size-4" />Preview</Button>}</div></article>)}</div>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>Add YouTube Episode</DialogTitle><DialogDescription>{providerName}</DialogDescription></DialogHeader><form className="grid gap-4" onSubmit={async e => { e.preventDefault(); if (!targetOwner) return; setBusy(true); try { await add({ data: { ...form, tmdb_id: Number(form.tmdb_id), provider_key: providerKey, owner_id: targetOwner } }); await qc.invalidateQueries({ queryKey: ['managed-content'] }); setOpen(false); setForm(blank); toast.success('Episode added'); } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not add episode'); } finally { setBusy(false); } }}>
      {me?.role === 'admin' && <label className="grid gap-2">Reseller<select required className={inputCls} value={owner} onChange={e => setOwner(e.target.value)}><option value="">Choose reseller</option><option value={me.id}>My customer lines</option>{resellers.map(r => <option key={r.id} value={r.id}>{r.display_name || r.email}</option>)}</select></label>}
      <div className="grid gap-4 sm:grid-cols-2">{(['english_name', 'original_name'] as const).map((key, i) => <label key={key} className="grid gap-2">{i ? 'Series name (original language)' : 'Series name (English)'}<input required maxLength={120} className={inputCls} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>)}</div>
      <label className="grid gap-2">TMDB ID<input required type="number" min="1" max="2147483647" className={inputCls} value={form.tmdb_id} onChange={e => setForm({ ...form, tmdb_id: e.target.value })} /></label>
      <div className="grid grid-cols-2 gap-4">{(['season_number', 'episode_number'] as const).map((key, i) => <label key={key} className="grid gap-2">{i ? 'Episode number' : 'Season number'}<input required type="number" min="1" max={i ? 9999 : 999} className={inputCls} value={form[key]} onChange={e => setForm({ ...form, [key]: Number(e.target.value) })} /></label>)}</div>
      <label className="grid gap-2">Language / dubbing<input required list="dubbing-labels" maxLength={200} className={inputCls} value={form.language_label} onChange={e => setForm({ ...form, language_label: e.target.value })} /><datalist id="dubbing-labels">{['KURDISH-دۆبلاژ', 'ARABIC-دوبلاج', 'ENGLISH', 'PERSIAN-دوبله'].map(l => <option key={l} value={l} />)}</datalist></label>
      {(['original_url', 'poster_url'] as const).map((key, i) => <label key={key} className="grid gap-2">{i ? 'Poster URL' : 'YouTube URL'}<input required type="url" className={inputCls} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>)}
      <output className="break-words rounded-md border border-border p-3 font-mono text-sm">{title || 'Episode title'}</output><Button type="submit" disabled={busy || !targetOwner}>{busy ? 'Saving…' : 'Add Episode'}</Button>
    </form></DialogContent></Dialog>
    <Dialog open={!!preview} onOpenChange={v => { if (!v) setPreview(null); }}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>{preview?.title}</DialogTitle><DialogDescription>YouTube</DialogDescription></DialogHeader>{preview && <YoutubePlayer videoId={preview.id} title={preview.title} />}</DialogContent></Dialog>
  </section>;
}