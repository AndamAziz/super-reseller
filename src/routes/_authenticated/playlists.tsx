import { createFileRoute } from "@tanstack/react-router";
import { AdminOnly } from "@/components/admin-only";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Panel, td, th, inputCls, softBtn, dangerBtn } from "@/components/panel";
import { useMe, errMsg } from "@/hooks/use-me";
import { usePlaylists } from "@/lib/queries";
import { parseM3UDocument, buildM3U, mediaSection, type M3UChannel } from "@/lib/m3u";
import { cn } from "@/lib/utils";
import { useServerFn } from "@tanstack/react-start";
import { testStream, type StreamTestStep } from "@/lib/stream-test.functions";
import { getSourcePlaylist } from "@/lib/source-playlist.functions";
import { sourcePlaylistQueryOptions } from "@/lib/source-playlist-query";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Plus, Play } from "lucide-react";
import { PlaylistEmbedPlayer } from '@/components/playlist-embed-player';
import { ChannelCreateDialog } from "@/components/channel-create-dialog";
import { ChannelLinksDialog } from "@/components/channel-links-dialog";
import { useDeleteChannel } from "@/lib/channel-delete";
import { channelNeighbor } from "@/lib/channel-order";
import { ChannelOrderButtons } from "@/components/channel-order-buttons";
import { ProviderYoutubeEpisodes } from '@/components/provider-youtube-episodes';

type TestResult = { loading: true } | { loading: false; ok: boolean; steps: StreamTestStep[]; error?: string };

export const Route = createFileRoute("/_authenticated/playlists")({
  loader: ({ context }) => context.queryClient.ensureQueryData(sourcePlaylistQueryOptions()),
  head: () => ({ meta: [{ title: "Playlists — Kurdistan IPTV" },
    { name: "description", content: "Manage and test Kurdistan IPTV audio, video and live playlists." },
    { property: "og:title", content: "Playlists — Kurdistan IPTV" },
    { property: "og:description", content: "Manage and test Kurdistan IPTV audio, video and live playlists." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <AdminOnly><PlaylistsPage /></AdminOnly>,
});

async function fetchAllChannels(playlistId: string) {
  const all: (M3UChannel & { id: string })[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("channels")
      .select("id, name, group_title, logo, url, referrer, type, user_agent, m3u_metadata")
      .eq("playlist_id", playlistId)
      .order("position")
        .order("id")
      .range(from, from + 999);
    if (error) throw error;
    all.push(...(data as unknown as (M3UChannel & { id: string })[]));
    if (data.length < 1000) break;
  }
  return all;
}

function PlaylistsPage() {
  const { data: me } = useMe();
  const isAdmin = me?.role === "admin";
  const qc = useQueryClient();
  const { data: playlists = [] } = usePlaylists();
  const [selected, setSelected] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [group, setGroup] = useState<string>("all");
  const [q, setQ] = useState("");
  const [section, setSection] = useState<"all" | "live" | "movie" | "series">("all");
  // Default to the newest imported playlist so the Edit links column is visible on load.
  const current = selected ?? playlists[0]?.id ?? "github";
  const isSource = current === "github";
  const { removeChannel, busyId } = useDeleteChannel(current);
  const fetchSource = useServerFn(getSourcePlaylist);
  const source = useQuery(sourcePlaylistQueryOptions(() => fetchSource()));
  const runTest = useServerFn(testStream);
  const [tests, setTests] = useState<Record<string, TestResult>>({});
  const [editing, setEditing] = useState<(M3UChannel & { id: string }) | null>(null);
  const [moving, setMoving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [watching, setWatching] = useState<M3UChannel | null>(null);

  async function test(c: M3UChannel & { id: string }) {
    setTests((t) => ({ ...t, [c.id]: { loading: true } }));
    try {
      const r = await runTest({ data: { url: c.url, referrer: c.referrer, user_agent: c.user_agent } });
      setTests((t) => ({ ...t, [c.id]: { loading: false, ok: r.ok, steps: r.steps } }));
    } catch (e) {
      setTests((t) => ({ ...t, [c.id]: { loading: false, ok: false, steps: [], error: errMsg(e) } }));
    }
  }

  const imported = useQuery({
    queryKey: ["channels", current],
    enabled: !isSource,
    queryFn: () => fetchAllChannels(current),
  });
  const channels = isSource ? source.data ?? [] : imported.data ?? [];
  const isLoading = isSource ? source.isLoading : imported.isLoading;

  const sectionChannels = useMemo(() => channels.filter((c) => section === "all" || mediaSection(c) === section), [channels, section]);
  const groups = useMemo(() => {
    const m = new Map<string, number>();
    sectionChannels.forEach((c) => m.set(c.group_title ?? "Uncategorized", (m.get(c.group_title ?? "Uncategorized") ?? 0) + 1));
    return [...m.entries()];
  }, [sectionChannels]);
  const activeGroup = group === "all" || groups.some(([name]) => name === group) ? group : "all";

  const shown = useMemo(() => {
    const s = q.toLowerCase();
    return sectionChannels.filter(
      (c) => (activeGroup === "all" || (c.group_title ?? "Uncategorized") === activeGroup) && (!s || c.name.toLowerCase().includes(s)),
    );
  }, [sectionChannels, activeGroup, q]);

  async function moveChannel(id: string, direction: -1 | 1) {
    const neighbor = channelNeighbor(shown, id, direction);
    if (!isAdmin || isSource || moving || !neighbor) return;
    setMoving(true);
    try {
      const { error } = await supabase.rpc("swap_channel_positions", { _channel_id: id, _neighbor_id: neighbor.id });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["channels", current] });
      toast.success("Channel order saved");
    } catch (e) { toast.error(errMsg(e)); }
    finally { setMoving(false); }
  }

  async function onFile(file: File) {
    try {
      // File.text() strips the BOM; retain it with the original header for export.
      const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(await file.arrayBuffer());
      const document = parseM3UDocument(text);
      const parsed = document.channels;
      if (!parsed.length) return void toast.error("No channels found in this file");
      setProgress(`Parsed ${parsed.length} channels…`);
      const { data: pl, error } = await supabase
        .from("playlists")
        .insert({ name: file.name, channel_count: parsed.length, m3u_header: document.header, m3u_newline: document.newline })
        .select()
        .single();
      if (error) throw error;
      for (let i = 0; i < parsed.length; i += 500) {
        const batch = parsed.slice(i, i + 500).map((c, j) => ({ ...c, m3u_metadata: c.m3u_metadata ? JSON.parse(JSON.stringify(c.m3u_metadata)) : null, playlist_id: pl.id, position: i + j }));
        const { error: cErr } = await supabase.from("channels").insert(batch);
        if (cErr) throw cErr;
        setProgress(`Importing ${Math.min(i + 500, parsed.length)} / ${parsed.length}`);
      }
      toast.success(`Imported ${parsed.length} channels`);
      setSelected(pl.id);
      qc.invalidateQueries({ queryKey: ["playlists"] });
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setProgress(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this playlist?")) return;
    const { error } = await supabase.from("playlists").delete().eq("id", id);
    if (error) return void toast.error(error.message);
    setSelected(null);
    qc.invalidateQueries({ queryKey: ["playlists"] });
  }

  function download() {
    const pl = playlists.find((p) => p.id === current);
    const blob = new Blob([buildM3U(channels, { header: pl?.m3u_header, newline: pl?.m3u_newline })], { type: "audio/x-mpegurl" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = pl?.name.endsWith(".m3u") ? pl.name : `${pl?.name ?? "playlist"}.m3u`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const preview = buildM3U(shown.slice(0, 3));

  return (
    <>
      <PageHeader
        eyebrow="iptv"
        title="Playlists"
        actions={
          isAdmin && (<div className="flex flex-wrap gap-2">
            {!isSource && <Button disabled={isLoading || moving || !!progress} className="h-11" onClick={() => setAdding(true)}><Plus />Add channel</Button>}
            <label className="cursor-pointer rounded-xl bg-primary px-4 py-2 font-display text-[13px] font-semibold text-primary-foreground hover:bg-primary/90">
              {progress ?? "Import M3U"}
              <input type="file" accept=".m3u,.m3u8,audio/x-mpegurl,text/plain" className="hidden" disabled={!!progress} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            </label></div>
          )
        }
      />

      {isAdmin && <StreamIdTester />}

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        <Button variant={isSource ? "default" : "outline"} className="h-auto shrink-0 py-2" onClick={() => { setSelected("github"); setGroup("all"); }}>
          <span className="text-left"><span className="block">GitHub playlist</span><span className="block font-mono text-[10px]">{source.data?.length ?? 0} channels</span></span>
        </Button>
        {playlists.map((p) => (
          <div key={p.id} className={cn("glass flex shrink-0 items-center gap-2 px-3 py-2", p.id === current && "ring-2 ring-primary/40")}>
            <button onClick={() => { setSelected(p.id); setGroup("all"); }} className="text-left">
              <div className="text-[13px] font-medium">{p.name}</div>
              <div className="font-mono text-[10px] text-muted-foreground">{p.channel_count} channels</div>
            </button>
            {isAdmin && <button className={dangerBtn} onClick={() => remove(p.id)}>×</button>}
          </div>
        ))}
      </div>
      {isSource && source.isError && <p role="alert" className="text-destructive">{errMsg(source.error)}</p>}
      {!isSource && !isLoading && channels.some((c) => !c.m3u_metadata) && <p role="alert" className="text-warn">This older import is missing original M3U attributes. Import the original file again to restore media sections and download its original format.</p>}

      <ProviderYoutubeEpisodes providerKey={current} providerName={isSource ? 'GitHub playlist' : playlists.find(p => p.id === current)?.name ?? 'Playlist'} />

      <div role="tablist" aria-label="Media sections" className="flex flex-wrap gap-2">
        {([ ["all", "All"], ["live", "Live TV"], ["movie", "Movies"], ["series", "Series"] ] as const).map(([value, label]) => (
          <Button key={value} role="tab" aria-selected={section === value} variant={section === value ? "default" : "outline"} className="h-11" onClick={() => { setSection(value); setGroup("all"); }}>
            {label} · {value === "all" ? channels.length : channels.filter((c) => mediaSection(c) === value).length}
          </Button>
        ))}
      </div>

      {current && (
        <section className="rise grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="glass order-2 min-w-0 p-4 sm:p-5 lg:order-none">
            <div className="label-mono">Playlist parser</div>
            <h2 className="mt-1 font-display text-[16px] font-semibold tracking-tight">M3U preview</h2>
            <pre className="mt-3 max-h-48 overflow-auto rounded-xl border border-border bg-ink p-4 font-mono text-[11.5px] leading-relaxed text-ink-foreground">
              {preview}
            </pre>
            <div className="mt-4 flex max-h-44 flex-wrap gap-2 overflow-y-auto sm:max-h-none sm:overflow-visible">
                <Button size="sm" onClick={() => setGroup("all")} className={cn("h-auto rounded-full px-3 py-1 text-[11px] font-medium ring-1 ring-border", activeGroup === "all" ? "bg-primary text-primary-foreground" : "bg-glass-strong text-foreground")}>
                All · {sectionChannels.length}
                </Button>
              {groups.map(([g, n]) => (
                <Button key={g} size="sm" onClick={() => setGroup(g)} className={cn("h-auto whitespace-normal rounded-full px-3 py-1 text-[11px] font-medium ring-1 ring-border", activeGroup === g ? "bg-primary text-primary-foreground" : "bg-glass-strong text-foreground")}>
                  {g} · {n}
                </Button>
              ))}
            </div>
          </div>
          <div className="glass order-1 p-4 sm:p-5 lg:order-none">
            <div className="label-mono">Import status</div>
            <div className="mt-3 flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-good/10 font-display text-[13px] font-bold text-good ring-1 ring-good/20">✓</div>
              <div className="leading-tight">
                <div className="text-[13px] font-medium">{isLoading ? "Loading…" : `${channels.length} channels parsed`}</div>
                <div className="font-mono text-[10px] text-muted-foreground">{groups.length} categories</div>
              </div>
            </div>
            <Button onClick={download} disabled={!channels.length || moving} variant="outline" className="mt-5 w-full py-3 sm:py-2">Download .m3u</Button>
          </div>
        </section>
      )}

      {current && (
        <Panel title="Channels" sub={`${shown.length} shown`} actions={<input type="search" placeholder="search channel" value={q} onChange={(e) => setQ(e.target.value)} className={`${inputCls} h-11 w-full text-base sm:h-auto sm:w-48 sm:text-[13px]`} />}>
          <ul className="divide-y divide-border md:hidden">
            {shown.slice(0, 300).map((c) => (
              <li key={c.id} className="space-y-2 px-4 py-3">
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                  {c.logo ? <img src={c.logo} alt="" loading="lazy" className="size-11 shrink-0 rounded-lg bg-muted object-contain" /> : <div className="size-11 shrink-0 rounded-lg bg-muted" />}
                  <div className="min-w-0">
                    <div className="truncate font-medium">{c.name}</div>
                    <div className="truncate text-[12px] text-muted-foreground">{c.group_title ?? "—"}{c.referrer ? " · Proxied" : ""}</div>
                  </div>
                  {isAdmin && !isSource && (
                    <div className="grid h-11 shrink-0 grid-flow-col gap-2">
                      <Button variant="outline" className="h-11 px-3" aria-label={`Edit channel ${c.name}`} onClick={() => setEditing(c)}><Pencil /> Edit</Button>
                      <Button variant="destructive" className="h-11 px-3" aria-label={`Delete channel ${c.name}`} disabled={busyId === c.id} onClick={() => removeChannel(c.id, c.name)}><Trash2 /></Button>
                    </div>
                  )}
                </div>
                <div className="truncate font-mono text-[11px] text-muted-foreground">{c.url}</div>
                {mediaSection(c) !== 'live' && <Button variant="outline" className="h-11" onClick={() => setWatching(c)} aria-label={`Watch ${c.name}`}><Play /> Watch</Button>}
                {isAdmin && !isSource && <ChannelOrderButtons name={c.name} canUp={!!channelNeighbor(shown, c.id, -1)} canDown={!!channelNeighbor(shown, c.id, 1)} busy={moving || busyId != null} onMove={(direction) => moveChannel(c.id, direction)} />}

                {isAdmin && (
                  <div>
                    <button className={`${softBtn} py-2`} disabled={tests[c.id]?.loading} onClick={() => test(c)}>{tests[c.id]?.loading ? "Testing…" : "Test stream"}</button>
                    <TestOutput r={tests[c.id]} />
                  </div>
                )}
              </li>
            ))}
            {shown.length > 300 && <li className="px-4 py-3 font-mono text-[11px] text-muted-foreground">Showing first 300 — refine with search or category.</li>}
          </ul>
          <div className="hidden max-h-[600px] overflow-auto md:block">
            <table className="w-full min-w-[720px] text-[13px]">
              <thead className="sticky top-0 bg-glass-strong backdrop-blur">
                <tr>
                  <th className={th}>Channel</th>
                  <th className={th}>Category</th>
                  <th className={th}>Stream URL</th>
                  <th className={th}>Requires referer</th>
                  {isAdmin && <th className={th}>Test stream</th>}
                  {isAdmin && !isSource && <th className={th}>Edit</th>}
                  {isAdmin && !isSource && <th className={th}>Order</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {shown.slice(0, 300).map((c) => (
                  <tr key={c.id} className="hover:bg-glass-strong">
                    <td className={td}>
                      <div className="flex items-center gap-2.5">
                        {c.logo ? <img src={c.logo} alt="" loading="lazy" className="size-7 rounded-md bg-muted object-contain" /> : <div className="size-7 rounded-md bg-muted" />}
                        <span className="font-medium">{c.name}</span>
                        {mediaSection(c) !== 'live' && <Button variant="outline" size="icon" className="shrink-0" title={`Watch ${c.name}`} aria-label={`Watch ${c.name}`} onClick={() => setWatching(c)}><Play /></Button>}
                      </div>
                    </td>
                    <td className={`${td} text-muted-foreground`}>{c.group_title ?? "—"}</td>
                    <td className={`${td} max-w-[360px] truncate font-mono text-[11px] text-muted-foreground`} title={c.url}>{c.url}</td>
                    <td className={td}>{c.referrer ? <span className="rounded-full bg-warn/10 px-2 py-0.5 text-[11px] font-medium text-warn ring-1 ring-warn/20" title={c.referrer}>Proxied</span> : <span className="text-muted-foreground">—</span>}</td>
                    {isAdmin && (
                      <td className={`${td} min-w-[220px] align-top`}>
                        <button className={softBtn} disabled={tests[c.id]?.loading} onClick={() => test(c)}>
                          {tests[c.id]?.loading ? "Testing…" : "Test stream"}
                        </button>
                        <TestOutput r={tests[c.id]} />
                      </td>
                    )}
                    {isAdmin && !isSource && <td className={td}>
                      <Button variant="ghost" size="icon" title={`Edit channel ${c.name}`} aria-label={`Edit channel ${c.name}`} onClick={() => setEditing(c)}><Pencil /></Button>
                    </td>}
                    {isAdmin && !isSource && <td className={td}><ChannelOrderButtons name={c.name} canUp={!!channelNeighbor(shown, c.id, -1)} canDown={!!channelNeighbor(shown, c.id, 1)} busy={moving || busyId != null} onMove={(direction) => moveChannel(c.id, direction)} /></td>}
                  </tr>
                ))}
              </tbody>
            </table>
            {shown.length > 300 && <p className="px-5 py-3 font-mono text-[11px] text-muted-foreground">Showing first 300 — refine with search or category.</p>}
          </div>
        </Panel>
      )}
      {editing && isAdmin && !isSource && <ChannelLinksDialog key={editing.id} channel={editing} playlistId={current} onClose={() => setEditing(null)} />}
      {watching && <PlaylistEmbedPlayer channel={watching} onClose={() => setWatching(null)} />}
      {adding && isAdmin && !isSource && <ChannelCreateDialog playlistId={current} playlistName={playlists.find((p) => p.id === current)?.name ?? "Playlist"} initialType={section === "all" ? "live" : section} onClose={() => setAdding(false)} onAdded={() => { setSection("all"); setGroup("all"); setQ(""); }} />}
    </>
  );
}

function TestOutput({ r }: { r: TestResult | undefined }) {
  if (!r || r.loading) return null;
  if (r.error) return <div className="mt-1.5 font-mono text-[11px] text-destructive">{r.error}</div>;
  return (
    <ul className="mt-1.5 space-y-0.5 font-mono text-[11px]">
      {r.steps.map((s, i) => (
        <li key={i} className={s.ok ? "text-good" : "text-destructive"} title={s.url}>
          {s.step}: {s.status ?? "ERR"}{s.error ? ` — ${s.error}` : ""} <span className="text-muted-foreground">{s.ms}ms</span>
        </li>
      ))}
    </ul>
  );
}

function StreamIdTester() {
  const runTest = useServerFn(testStream);
  const [id, setId] = useState("");
  const [name, setName] = useState<string | null>(null);
  const [r, setR] = useState<TestResult | undefined>();
  async function go() {
    const n = Number.parseInt(id, 10);
    if (!Number.isFinite(n) || n < 1) return void toast.error("Enter a stream number");
    setR({ loading: true }); setName(null);
    try {
      const res = await runTest({ data: { streamId: n } });
      setName(res.name);
      setR({ loading: false, ok: res.ok, steps: res.steps });
    } catch (e) {
      setR({ loading: false, ok: false, steps: [], error: errMsg(e) });
    }
  }
  return (
    <Panel title="Test stream" sub="Fetches the playlist and first segment through the proxy, exactly like a player">
      <div className="flex flex-wrap items-center gap-2 px-5 pb-4">
        <input inputMode="numeric" placeholder="stream number, e.g. 186" value={id} onChange={(e) => setId(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} className={`${inputCls} h-11 w-full text-base sm:h-auto sm:w-56 sm:text-[12px]`} />
        <button className={softBtn} disabled={r?.loading} onClick={go}>{r?.loading ? "Testing…" : "Test stream"}</button>
        {name && <span className="text-[13px] font-medium">{name}</span>}
        {r && !r.loading && <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1", r.ok ? "bg-good/10 text-good ring-good/20" : "bg-destructive/10 text-destructive ring-destructive/20")}>{r.ok ? "OK" : "Failed"}</span>}
      </div>
      <div className="px-5 pb-4"><TestOutput r={r} /></div>
    </Panel>
  );
}
