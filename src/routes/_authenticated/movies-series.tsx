import { createFileRoute } from '@tanstack/react-router';
import { queryOptions, useSuspenseQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { Film, Tv, Search, Plus, Play, Pencil, Trash2, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { AdminOnly } from '@/components/admin-only';
import { PageHeader, inputCls } from '@/components/panel';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VodPlayer } from '@/components/vod-player';
import { listVod, searchVod, getVodDetails, saveVod, deleteVod } from '@/lib/vod.functions';
import { vodLibraryKey, type VodEntry, type VodKind, type VodMetadata } from '@/lib/vod';

const libraryOptions = () => queryOptions({ queryKey: vodLibraryKey, queryFn: () => listVod() });
export const Route = createFileRoute('/_authenticated/movies-series')({
  head: () => ({ meta: [{ title: 'Movies & Series — Kurdistan IPTV' }, { name: 'description', content: 'Manage Kurdistan IPTV movies and series with TMDB metadata and VidAPI playback.' }, { property: 'og:title', content: 'Movies & Series — Kurdistan IPTV' }, { property: 'og:description', content: 'Admin movie and series library, metadata and player testing.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: () => <AdminOnly><Library /></AdminOnly>,
});

function Library() {
  const { data: library } = useSuspenseQuery(libraryOptions());
  const qc = useQueryClient();
  const search = useServerFn(searchVod), details = useServerFn(getVodDetails), save = useServerFn(saveVod), remove = useServerFn(deleteVod);
  const [kind, setKind] = useState<VodKind>('movie');
  const [query, setQuery] = useState(''), [filter, setFilter] = useState('');
  const [results, setResults] = useState<VodMetadata[] | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [editing, setEditing] = useState<VodMetadata | null>(null);
  const [season, setSeason] = useState(1), [episode, setEpisode] = useState(1);
  const [watching, setWatching] = useState<VodEntry | null>(null), [deleting, setDeleting] = useState<VodEntry | null>(null);
  const message = (e: unknown) => e instanceof Error ? e.message : 'Request failed. Please try again.';
  async function find() { setBusy(true); setError(''); try { setResults(await search({ data: { media_type: kind, query } })); } catch (e) { setError(message(e)); } finally { setBusy(false); } }
  async function edit(item: VodMetadata | VodEntry) {
    setBusy(true); setError('');
    try { const data = await details({ data: { media_type: item.media_type, tmdb_id: item.tmdb_id } }); setEditing(data); setSeason('season' in item ? item.season : data.seasons[0]?.season_number ?? 1); setEpisode('episode' in item ? item.episode : 1); }
    catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  async function store() {
    if (!editing) return; setBusy(true);
    try { await save({ data: { media_type: editing.media_type, tmdb_id: editing.tmdb_id, season, episode } }); await qc.invalidateQueries({ queryKey: vodLibraryKey }); setEditing(null); toast.success('Title saved'); }
    catch (e) { toast.error(message(e)); } finally { setBusy(false); }
  }
  const items = library.filter(i => i.media_type === kind && i.title.toLowerCase().includes(filter.toLowerCase()));
  return <>
    <PageHeader eyebrow="Content library · Super Admin" title="Movies & Series" actions={<span className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">VidAPI / TMDB</span>} />
    <div className="flex flex-wrap items-center justify-between gap-4 border-y border-border py-4"><Tabs value={kind} onValueChange={value => { setKind(value as VodKind); setResults(null); setError(''); }}><TabsList><TabsTrigger value="movie"><Film className="mr-2 size-4" />Movies · {library.filter(i => i.media_type === 'movie').length}</TabsTrigger><TabsTrigger value="tv"><Tv className="mr-2 size-4" />Series · {library.filter(i => i.media_type === 'tv').length}</TabsTrigger></TabsList></Tabs><input aria-label="Filter library" placeholder="Filter library…" className={`${inputCls} w-full sm:w-56`} value={filter} onChange={e => setFilter(e.target.value)} /></div>
    <section className="space-y-4"><h2 className="font-display text-lg font-semibold">Add {kind === 'movie' ? 'a movie' : 'a series'}</h2><form className="flex gap-2" onSubmit={e => { e.preventDefault(); void find(); }}><input aria-label="Search TMDB" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search titles on TMDB…" className={`${inputCls} flex-1`} maxLength={120} /><Button type="submit" disabled={busy || query.trim().length < 2} className="min-h-11">{busy ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}Search</Button></form>{error && <p role="alert" className="text-destructive">{error}</p>}
      {results && <div className="border-y border-border py-4"><div className="mb-3 flex items-center justify-between"><h3 className="font-medium">TMDB results · {results.length}</h3><Button size="icon" variant="ghost" aria-label="Close search results" onClick={() => setResults(null)}><X /></Button></div><div className="grid gap-3 sm:grid-cols-2">{results.map(item => <article key={item.tmdb_id} className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-glass p-3"><Poster path={item.poster_path} title={item.title} small /><div className="min-w-0 flex-1"><h3 className="break-words font-medium">{item.title}</h3><p className="mt-1 text-xs text-muted-foreground">{item.release_date.slice(0, 4) || 'Undated'} · TMDB {item.tmdb_id}</p></div><Button size="icon" variant="outline" className="size-11 shrink-0" title="View details and add" aria-label={`Add ${item.title}`} disabled={busy} onClick={() => void edit(item)}><Plus /></Button></article>)}</div>{!results.length && <p className="text-muted-foreground">No matching titles.</p>}</div>}
    </section>
    <section className="space-y-4 border-t border-border pt-5"><h2 className="font-display text-lg font-semibold">Your {kind === 'movie' ? 'movies' : 'series'} <span className="text-sm font-normal text-muted-foreground">{items.length} titles</span></h2><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{items.map(item => <article key={item.id} className="min-w-0 overflow-hidden rounded-lg border border-border bg-glass"><Poster path={item.poster_path} title={item.title} /><div className="p-3"><h3 className="min-h-10 break-words text-sm font-semibold">{item.title}</h3><p className="my-2 text-xs text-muted-foreground">{item.release_date.slice(0, 4)}{kind === 'tv' ? ` · S${item.season} E${item.episode}` : ' · Movie'}</p><div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-1"><Button variant="outline" className="min-h-11 px-2" onClick={() => setWatching(item)}><Play className="size-4" />Test</Button><Button variant="ghost" size="icon" className="size-11" disabled={busy} aria-label={`Edit ${item.title}`} title="Details / edit" onClick={() => void edit(item)}><Pencil className="size-4" /></Button><Button variant="ghost" size="icon" className="size-11 text-destructive" aria-label={`Remove ${item.title}`} title="Remove" onClick={() => setDeleting(item)}><Trash2 className="size-4" /></Button></div></div></article>)}</div>{!items.length && <div className="flex items-center gap-4 border-y border-dashed border-border py-8 text-muted-foreground"><Film className="size-8 shrink-0" /><p>No {kind === 'movie' ? 'movies' : 'series'} saved{filter ? ' matching your search' : ' yet'}.</p></div>}</section>
    {editing && <Dialog open onOpenChange={open => { if (!open) setEditing(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogTitle className="pr-6 break-words">{editing.title}</DialogTitle><DialogDescription>TMDB {editing.tmdb_id} · {editing.release_date || 'Undated'}</DialogDescription><div className="flex gap-4"><Poster path={editing.poster_path} title={editing.title} small /><p className="text-sm text-muted-foreground">{editing.overview || 'No synopsis supplied.'}</p></div>{editing.media_type === 'tv' && <div className="grid grid-cols-2 gap-3"><label className="space-y-2 text-sm">Season<select aria-label="Season" className={`${inputCls} w-full`} value={season} onChange={e => { setSeason(Number(e.target.value)); setEpisode(1); }}>{editing.seasons.map(s => <option key={s.season_number} value={s.season_number}>{s.name}</option>)}</select></label><label className="space-y-2 text-sm">Episode<select aria-label="Episode" className={`${inputCls} w-full`} value={episode} onChange={e => setEpisode(Number(e.target.value))}>{Array.from({ length: editing.seasons.find(s => s.season_number === season)?.episode_count ?? 0 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></label></div>}<Button className="min-h-11" disabled={busy || (editing.media_type === 'tv' && !editing.seasons.length)} onClick={() => void store()}><Plus />{busy ? 'Saving…' : 'Save to library'}</Button></DialogContent></Dialog>}
    {watching && <VodPlayer item={watching} onClose={() => setWatching(null)} />}
    {deleting && <Dialog open onOpenChange={open => { if (!open) setDeleting(null); }}><DialogContent><DialogTitle>Remove title?</DialogTitle><DialogDescription>{deleting.title} will be removed from this library only.</DialogDescription><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button><Button variant="destructive" disabled={busy} onClick={async () => { setBusy(true); try { await remove({ data: { id: deleting.id } }); await qc.invalidateQueries({ queryKey: vodLibraryKey }); setDeleting(null); } catch (e) { toast.error(message(e)); } finally { setBusy(false); } }}><Trash2 />Remove</Button></div></DialogContent></Dialog>}
  </>;
}

function Poster({ path, title, small = false }: { path: string | null; title: string; small?: boolean }) {
  const cls = small ? 'h-24 w-16 shrink-0 rounded-md object-cover' : 'aspect-[2/3] w-full object-cover';
  return path ? <img src={`https://image.tmdb.org/t/p/w342${path}`} alt={title} loading="lazy" className={cls} /> : <div className={`${cls} grid place-items-center bg-glass-strong text-muted-foreground`}><Film className="size-8" /></div>;
}