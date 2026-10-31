import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Panel, td, th, inputCls, softBtn, dangerBtn } from "@/components/panel";
import { useMe, errMsg } from "@/hooks/use-me";
import { usePlaylists } from "@/lib/queries";
import { parseM3U, buildM3U, type M3UChannel } from "@/lib/m3u";
import { cn } from "@/lib/utils";
import { useServerFn } from "@tanstack/react-start";
import { testStream, type StreamTestStep } from "@/lib/stream-test.functions";
import { getSourcePlaylist } from "@/lib/source-playlist.functions";
import { sourcePlaylistQueryOptions } from "@/lib/source-playlist-query";
import { Button } from "@/components/ui/button";

type TestResult = { loading: true } | { loading: false; ok: boolean; steps: StreamTestStep[]; error?: string };

export const Route = createFileRoute("/_authenticated/playlists")({
  loader: ({ context }) => context.queryClient.ensureQueryData(sourcePlaylistQueryOptions()),
  head: () => ({ meta: [{ title: "Playlists — Kurdistan IPTV" },
    { name: "description", content: "Manage and test Kurdistan IPTV audio, video and live playlists." },
    { property: "og:title", content: "Playlists — Kurdistan IPTV" },
    { property: "og:description", content: "Manage and test Kurdistan IPTV audio, video and live playlists." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: PlaylistsPage,
});

async function fetchAllChannels(playlistId: string) {
  const all: (M3UChannel & { id: string })[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("channels")
      .select("id, name, group_title, logo, url, referrer")
      .eq("playlist_id", playlistId)
      .order("position")
      .range(from, from + 999);
    if (error) throw error;
    all.push(...data);
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
  const current = selected ?? "github";
  const isSource = current === "github";
  const fetchSource = useServerFn(getSourcePlaylist);
  const source = useQuery(sourcePlaylistQueryOptions(() => fetchSource()));
  const runTest = useServerFn(testStream);
  const [tests, setTests] = useState<Record<string, TestResult>>({});

  async function test(c: M3UChannel & { id: string }) {
    setTests((t) => ({ ...t, [c.id]: { loading: true } }));
    try {
      const r = await runTest({ data: { url: c.url, referrer: c.referrer } });
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

  const groups = useMemo(() => {
    const m = new Map<string, number>();
    channels.forEach((c) => m.set(c.group_title ?? "Uncategorized", (m.get(c.group_title ?? "Uncategorized") ?? 0) + 1));
    return [...m.entries()];
  }, [channels]);
  const activeGroup = group === "all" || groups.some(([name]) => name === group) ? group : "all";

  const shown = useMemo(() => {
    const s = q.toLowerCase();
    return channels.filter(
      (c) => (activeGroup === "all" || (c.group_title ?? "Uncategorized") === activeGroup) && (!s || c.name.toLowerCase().includes(s)),
    );
  }, [channels, activeGroup, q]);

  async function onFile(file: File) {
    try {
      const text = await file.text();
      const parsed = parseM3U(text);
      if (!parsed.length) return void toast.error("No channels found in this file");
      setProgress(`Parsed ${parsed.length} channels…`);
      const { data: pl, error } = await supabase
        .from("playlists")
        .insert({ name: file.name, channel_count: parsed.length })
        .select()
        .single();
      if (error) throw error;
      for (let i = 0; i < parsed.length; i += 500) {
        const batch = parsed.slice(i, i + 500).map(({ type: _t, user_agent: _ua, ...c }, j) => ({ ...c, playlist_id: pl.id, position: i + j }));
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
    const blob = new Blob([buildM3U(channels)], { type: "audio/x-mpegurl" });
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
          isAdmin && (
            <label className="cursor-pointer rounded-xl bg-primary px-4 py-2 font-display text-[13px] font-semibold text-primary-foreground hover:bg-primary/90">
              {progress ?? "Import M3U"}
              <input type="file" accept=".m3u,.m3u8,audio/x-mpegurl,text/plain" className="hidden" disabled={!!progress} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            </label>
          )
        }
      />

      {isAdmin && <StreamIdTester />}

      <div className="flex flex-wrap gap-2">
        <Button variant={isSource ? "default" : "outline"} className="h-auto py-2" onClick={() => { setSelected("github"); setGroup("all"); }}>
          <span className="text-left"><span className="block">GitHub playlist</span><span className="block font-mono text-[10px]">{source.data?.length ?? 0} channels</span></span>
        </Button>
        {playlists.map((p) => (
          <div key={p.id} className={cn("glass flex items-center gap-2 px-3 py-2", p.id === current && "ring-2 ring-primary/40")}>
            <button onClick={() => { setSelected(p.id); setGroup("all"); }} className="text-left">
              <div className="text-[13px] font-medium">{p.name}</div>
              <div className="font-mono text-[10px] text-muted-foreground">{p.channel_count} channels</div>
            </button>
            {isAdmin && <button className={dangerBtn} onClick={() => remove(p.id)}>×</button>}
          </div>
        ))}
      </div>
      {isSource && source.isError && <p role="alert" className="text-destructive">{errMsg(source.error)}</p>}

      {current && (
        <section className="rise grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="glass p-5">
            <div className="label-mono">Playlist parser</div>
            <h2 className="mt-1 font-display text-[16px] font-semibold tracking-tight">M3U preview</h2>
            <pre className="mt-3 max-h-48 overflow-auto rounded-xl border border-border bg-ink p-4 font-mono text-[11.5px] leading-relaxed text-ink-foreground">
              {preview}
            </pre>
            <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setGroup("all")} className={cn("h-auto rounded-full px-3 py-1 text-[11px] font-medium ring-1 ring-border", activeGroup === "all" ? "bg-primary text-primary-foreground" : "bg-glass-strong text-foreground")}>
                All · {channels.length}
                </Button>
              {groups.map(([g, n]) => (
                <Button key={g} size="sm" onClick={() => setGroup(g)} className={cn("h-auto whitespace-normal rounded-full px-3 py-1 text-[11px] font-medium ring-1 ring-border", activeGroup === g ? "bg-primary text-primary-foreground" : "bg-glass-strong text-foreground")}>
                  {g} · {n}
                </Button>
              ))}
            </div>
          </div>
          <div className="glass p-5">
            <div className="label-mono">Import status</div>
            <div className="mt-3 flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-good/10 font-display text-[13px] font-bold text-good ring-1 ring-good/20">✓</div>
              <div className="leading-tight">
                <div className="text-[13px] font-medium">{isLoading ? "Loading…" : `${channels.length} channels parsed`}</div>
                <div className="font-mono text-[10px] text-muted-foreground">{groups.length} categories</div>
              </div>
            </div>
            <button onClick={download} disabled={!channels.length} className={`${softBtn} mt-5 w-full py-2`}>Download .m3u</button>
          </div>
        </section>
      )}

      {current && (
        <Panel title="Channels" sub={`${shown.length} shown`} actions={<input placeholder="search channel" value={q} onChange={(e) => setQ(e.target.value)} className={`${inputCls} w-48`} />}>
          <div className="max-h-[600px] overflow-auto">
            <table className="w-full min-w-[720px] text-[13px]">
              <thead className="sticky top-0 bg-glass-strong backdrop-blur">
                <tr>
                  <th className={th}>Channel</th>
                  <th className={th}>Category</th>
                  <th className={th}>Stream URL</th>
                  <th className={th}>Requires referer</th>
                  {isAdmin && <th className={th}>Test stream</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {shown.slice(0, 300).map((c) => (
                  <tr key={c.id} className="hover:bg-glass-strong">
                    <td className={td}>
                      <div className="flex items-center gap-2.5">
                        {c.logo ? <img src={c.logo} alt="" loading="lazy" className="size-7 rounded-md bg-muted object-contain" /> : <div className="size-7 rounded-md bg-muted" />}
                        <span className="font-medium">{c.name}</span>
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
                  </tr>
                ))}
              </tbody>
            </table>
            {shown.length > 300 && <p className="px-5 py-3 font-mono text-[11px] text-muted-foreground">Showing first 300 — refine with search or category.</p>}
          </div>
        </Panel>
      )}
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
        <input inputMode="numeric" placeholder="stream number, e.g. 186" value={id} onChange={(e) => setId(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} className={`${inputCls} w-56`} />
        <button className={softBtn} disabled={r?.loading} onClick={go}>{r?.loading ? "Testing…" : "Test stream"}</button>
        {name && <span className="text-[13px] font-medium">{name}</span>}
        {r && !r.loading && <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1", r.ok ? "bg-good/10 text-good ring-good/20" : "bg-destructive/10 text-destructive ring-destructive/20")}>{r.ok ? "OK" : "Failed"}</span>}
      </div>
      <div className="px-5 pb-4"><TestOutput r={r} /></div>
    </Panel>
  );
}
