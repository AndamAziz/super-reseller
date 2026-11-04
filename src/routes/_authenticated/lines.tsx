import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Copy, Link2, Pencil, Sparkles, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Panel, StatusBadge, FullBadge, td, th, inputCls, softBtn, dangerBtn, primaryBtn } from "@/components/panel";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { connectionUpgradeCost, renewalCost } from "@/lib/connection-pricing";
import { customerLinks } from "@/lib/customer-links";

function copyItems(l: Parameters<typeof customerLinks>[0]) {
  const links = customerLinks(l);
  return [
    { label: "m3u", short: "M3U", title: "Copy M3U link", toast: "M3U link", value: links.m3u },
    { label: "host", short: "Host", title: "Copy provider host", toast: "Provider host", value: links.provider },
    { label: "combined", short: "M3U + YT", title: "Copy combined M3U + YouTube catalogue link", toast: "Combined catalogue link", value: links.content },
  ];
}
import { Button } from "@/components/ui/button";
import { useMe, isActive, fmtDate, errMsg } from "@/hooks/use-me";
import { useLines } from "@/lib/queries";
import { recommendDuration } from "@/lib/recommend.functions";
import { checkTestUsed, createLine, createTestLine, deleteLine, renewLine, updateLine } from "@/lib/lines.functions";

export const Route = createFileRoute("/_authenticated/lines")({
  head: () => ({ meta: [
    { title: "Lines — Kurdistan IPTV" },
    { name: "description", content: "Manage Kurdistan IPTV subscriptions, connection limits and credit renewals." },
    { property: "og:title", content: "Lines — Kurdistan IPTV" },
    { property: "og:description", content: "Manage Kurdistan IPTV subscriptions, connection limits and credit renewals." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: LinesPage,
});

const schema = z.object({
  username: z.string().trim().min(3, "Username: min 3 chars").max(50).regex(/^[\w.-]+$/, "Username: letters, numbers, . _ - only"),
  password: z.string().min(4, "Password: min 4 chars").max(100),
  months: z.number().int().min(1).max(24),
});

const MONTHS = [1, 3, 6, 12];
const DURATIONS: { value: number; label: string }[] = [
  { value: 0, label: "24H test (free)" },
  ...MONTHS.map((m) => ({ value: m, label: `${m} month${m > 1 ? "s" : ""}` })),
];

function LinesPage() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const isAdmin = me?.role === "admin";
  const { data: lines = [] } = useLines();
  const createLineFn = useServerFn(createLine);
  const createTestLineFn = useServerFn(createTestLine);
  const renewLineFn = useServerFn(renewLine);
  const deleteLineFn = useServerFn(deleteLine);
  const updateLineFn = useServerFn(updateLine);
  const recommendFn = useServerFn(recommendDuration);
  const checkTestFn = useServerFn(checkTestUsed);
  const [form, setForm] = useState({ username: "", password: "", months: 1, host: "", customer: "" });
  const [testUsed, setTestUsed] = useState<{ used: boolean; at: string | null } | null>(null);
  const [needs, setNeeds] = useState("");
  const [rec, setRec] = useState<{ months: number; explanation: string } | null>(null);
  const [recBusy, setRecBusy] = useState(false);

  useEffect(() => {
    const c = form.customer.trim();
    if (c.length < 3) return void setTestUsed(null);
    const t = setTimeout(() => {
      checkTestFn({ data: { customer: c } }).then(setTestUsed).catch(() => setTestUsed(null));
    }, 400);
    return () => clearTimeout(t);
  }, [form.customer, checkTestFn]);

  async function recommend(e: React.FormEvent) {
    e.preventDefault();
    if (needs.trim().length < 3) return void toast.error("Describe what the customer needs");
    setRecBusy(true);
    setRec(null);
    try {
      setRec(await recommendFn({ data: { needs } }));
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setRecBusy(false);
    }
  }
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "expired">("all");
  const [renewMonths, setRenewMonths] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<{ id: string; username: string; password: string; host: string; expires: string; maxConn: number } | null>(null);
  const [source, setSource] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    supabase
      .from("app_settings")
      .select("value")
      .eq("key", "m3u_source_url")
      .maybeSingle()
      .then(({ data }) => setSource(data?.value ?? ""));
  }, [isAdmin]);

  async function copyLink(link: string, kind: string) {
    try {
      await navigator.clipboard.writeText(link);
      toast.success(`${kind} copied`);
    } catch {
      toast.error("Couldn't copy — select the link manually");
    }
  }

  async function saveSource(e: React.FormEvent) {
    e.preventDefault();
    const url = (source ?? "").trim();
    if (!/^https?:\/\/\S+$/i.test(url)) return void toast.error("Enter a valid http(s) M3U link");
    const { error } = await supabase.from("app_settings").upsert({ key: "m3u_source_url", value: url, updated_at: new Date().toISOString() });
    if (error) return void toast.error(error.message);
    toast.success("Playlist source saved");
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    if (editing.password.length < 4) return void toast.error("Password: min 4 chars");
    try {
      const result = await updateLineFn({
        data: {
          lineId: editing.id,
          password: editing.password,
          customHost: editing.host.trim() || null,
          maxConnections: editing.maxConn,
          expiresAt: isAdmin && editing.expires ? new Date(`${editing.expires}T23:59:59Z`).toISOString() : null,
        },
      });
      toast.success(result.creditsCharged ? `Line updated · ${result.creditsCharged} credits deducted` : "Line updated");
      setEditing(null);
      refresh();
    } catch (err) {
      toast.error(errMsg(err));
    }
  }

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["lines"] });
    qc.invalidateQueries({ queryKey: ["me"] });
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["resellers"] });
  };

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const isTest = form.months === 0;
    const parsed = schema.safeParse({ ...form, months: isTest ? 1 : form.months });
    if (!parsed.success) return void toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
    if (isTest && form.customer.trim().length < 3) return void toast.error("Enter the customer's phone or ID for a test line");
    if (isTest && testUsed?.used) return void toast.error("This customer already used their free 24H test");
    setBusy(true);
    try {
      if (isTest) {
        await createTestLineFn({ data: { username: parsed.data.username, password: parsed.data.password, customer: form.customer.trim() } });
      } else {
        await createLineFn({ data: { ...parsed.data, ...(form.host.trim() ? { customHost: form.host.trim() } : {}) } });
      }
      toast.success(`Line ${parsed.data.username} created`);
      setForm({ username: "", password: "", months: 1, host: "", customer: "" });
      setTestUsed(null);
      refresh();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function renew(id: string) {
    const months = renewMonths[id] ?? 1;
    try {
      await renewLineFn({ data: { lineId: id, months } });
      toast.success(`Renewed for ${months} month${months > 1 ? "s" : ""}`);
      refresh();
    } catch (err) {
      toast.error(errMsg(err));
    }
  }

  async function remove(id: string, username: string) {
    if (!confirm(`Delete line ${username}? Credits are not refunded.`)) return;
    try {
      await deleteLineFn({ data: { lineId: id, username } });
      toast.success("Line deleted");
      refresh();
    } catch (err) {
      toast.error(errMsg(err));
    }
  }

  const shown = useMemo(
    () =>
      lines.filter((l) => {
        const a = isActive(l.expires_at);
        if (filter === "active" && !a) return false;
        if (filter === "expired" && a) return false;
        const s = q.toLowerCase();
        return !s || l.username.toLowerCase().includes(s) || (l.profiles?.display_name ?? "").toLowerCase().includes(s);
      }),
    [lines, q, filter],
  );
  const active = lines.filter((l) => isActive(l.expires_at)).length;
  const cost = isAdmin || form.months === 0 ? 0 : form.months;
  const originalLine = editing ? lines.find((l) => l.id === editing.id) : undefined;
  const upgradeCost = !isAdmin && editing && originalLine
    ? connectionUpgradeCost(originalLine.expires_at, originalLine.max_connections ?? 1, editing.maxConn)
    : 0;
  const insufficientUpgradeCredits = upgradeCost > (me?.credits ?? 0);

  return (
    <>
      <PageHeader eyebrow="customers" title="Subscription lines" />

      {isAdmin && (
        <details className="rise border-y border-border bg-glass px-4 py-3"><summary className="cursor-pointer py-2 font-medium">Protected M3U source</summary><form onSubmit={saveSource} className="grid gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <label className="min-w-0 space-y-1.5">
            <span className="label-mono inline-flex items-center gap-1.5"><Link2 className="size-3.5" /> Protected M3U source</span>
            <input
              className={`${inputCls} w-full py-2 font-mono text-[12px]`}
              placeholder="https://…/playlist.m3u"
              value={source ?? ""}
              onChange={(e) => setSource(e.target.value)}
            />
            <span className="block text-[11px] text-muted-foreground">Clients never see this address — they get their own link that checks username, password and expiry.</span>
          </label>
          <Button className={primaryBtn}>Save source</Button>
        </form></details>
      )}

      <details className="rise border-y border-border bg-glass px-4 py-3"><summary className="cursor-pointer py-2 font-medium">Duration advisor</summary><form onSubmit={recommend} className="grid gap-3 py-3 lg:grid-cols-[1fr_auto] lg:items-end">
        <label className="space-y-1.5">
          <span className="label-mono inline-flex items-center gap-1.5"><Sparkles className="size-3.5" /> Duration advisor</span>
          <input
            className={`${inputCls} w-full py-2`}
            placeholder="e.g. new customer, watches football on weekends, wants to try first"
            value={needs}
            onChange={(e) => setNeeds(e.target.value)}
          />
        </label>
        <Button disabled={recBusy} className={softBtn}>{recBusy ? "Thinking…" : "Recommend"}</Button>
        {rec && (
          <div className="flex flex-wrap items-center gap-3 text-[13px] lg:col-span-2">
            <span className="font-mono">{rec.months === 0 ? "24H test" : `${rec.months} month${rec.months > 1 ? "s" : ""}`}</span>
            <span className="text-muted-foreground">{rec.explanation}</span>
            <Button type="button" className={softBtn} onClick={() => setForm((f) => ({ ...f, months: rec.months }))}>Use this</Button>
          </div>
        )}
      </form></details>

      <form onSubmit={create} className="rise grid gap-4 border-y border-border bg-glass px-4 py-5 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto_auto] lg:items-end">
        <label className="space-y-1.5">
          <span className="label-mono">Username</span>
          <input className={`${inputCls} w-full py-2`} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        </label>
        <label className="space-y-1.5">
          <span className="label-mono">Password</span>
          <input className={`${inputCls} w-full py-2`} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </label>
        <label className="space-y-1.5">
          <span className="label-mono">Custom host (optional)</span>
          <input
            className={`${inputCls} w-full py-2`}
            placeholder="https://myhost.com"
            value={form.host}
            onChange={(e) => setForm({ ...form, host: e.target.value })}
          />
        </label>
        <label className="space-y-1.5">
          <span className="label-mono">Duration</span>
          <select className={`${inputCls} w-full py-2`} value={form.months} onChange={(e) => setForm({ ...form, months: Number(e.target.value) })}>
            {DURATIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </label>
        {form.months === 0 && (
          <label className="space-y-1.5 sm:col-span-2 lg:col-span-5">
            <span className="label-mono">Customer phone or ID (one free test each)</span>
            <input className={`${inputCls} w-full py-2`} value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} />
            {testUsed?.used && <span className="block text-[12px] text-destructive">Test already used{testUsed.at ? ` on ${fmtDate(testUsed.at)}` : ""} — choose a paid duration.</span>}
            {testUsed && !testUsed.used && <span className="block text-[12px] text-muted-foreground">Free test available for this customer.</span>}
          </label>
        )}
        <Button disabled={busy || (form.months === 0 && !!testUsed?.used)} className={primaryBtn}>
          {busy ? "Creating…" : isAdmin ? "Create line" : `Create · ${cost} credit${cost > 1 ? "s" : ""}`}
        </Button>
        {!isAdmin && (
          <p className="text-[11px] text-muted-foreground sm:col-span-2 lg:col-span-5">
            Balance: <span className="font-mono">{me?.credits ?? 0}</span> credits · 1 credit = 1 month
          </p>
        )}
      </form>

      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        {editing && <DialogContent aria-describedby={undefined} className="max-h-[85dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg p-5">
        <DialogHeader><DialogTitle className="break-all pr-6">Edit line · {editing.username}</DialogTitle></DialogHeader>
        <form onSubmit={saveEdit} className="grid min-w-0 gap-4 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="label-mono">Password</span>
            <input className={`${inputCls} w-full py-2`} value={editing.password} onChange={(e) => setEditing({ ...editing, password: e.target.value })} />
          </label>
          <label className="space-y-1.5">
            <span className="label-mono">Custom host</span>
            <input className={`${inputCls} w-full py-2`} placeholder="https://myhost.com" value={editing.host} onChange={(e) => setEditing({ ...editing, host: e.target.value })} />
          </label>
          <label className="space-y-1.5">
            <span className="label-mono">Expires</span>
            <input
              type="date"
              disabled={!isAdmin}
              title={isAdmin ? undefined : "Use Renew to extend with credits"}
              className={`${inputCls} w-full py-2`}
              value={editing.expires}
              onChange={(e) => setEditing({ ...editing, expires: e.target.value })}
            />
          </label>
          <label className="space-y-1.5">
            <span className="label-mono">Max connections</span>
            <input
              type="number"
              min={1}
              max={100}
              className={`${inputCls} w-full py-2`}
              value={editing.maxConn}
              onChange={(e) => setEditing({ ...editing, maxConn: Math.min(100, Math.max(1, Number(e.target.value) || 1)) })}
            />
          </label>
          <Button type="submit" disabled={insufficientUpgradeCredits} className={primaryBtn}>
            {isAdmin ? "Save" : `Save · ${upgradeCost} credits`}
          </Button>
          <Button type="button" variant="outline" className={softBtn} onClick={() => setEditing(null)}>Cancel</Button>
          {!isAdmin && (
            <p className="text-[12px] text-muted-foreground sm:col-span-2">
              Additional connections: 1 credit each per remaining month (partial months rounded up).
              {` Balance: ${me?.credits ?? 0} credits. Reductions do not refund credits.`}
              {insufficientUpgradeCredits && <span className="ml-2 text-destructive">Insufficient credits.</span>}
            </p>
          )}
        </form>
        </DialogContent>}
      </Dialog>

      <Panel
        title="All lines"
        sub={`${active} active · ${lines.length - active} expired`}
        actions={
          <>
            <input aria-label="Search lines" placeholder="Search lines" value={q} onChange={(e) => setQ(e.target.value)} className={`${inputCls} w-full sm:w-48`} />
            <select aria-label="Line status" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className={inputCls}>
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
            </select>
          </>
        }
      >
        <div className="divide-y divide-border xl:hidden">
          {shown.map((l) => {
            const max = l.max_connections ?? 1;
            const live = l.active_connections ?? 0;
            const full = live >= max;
            return <article key={l.id} data-full={full ? "true" : undefined} className={cn("min-w-0 space-y-4 px-4 py-5", full && "border-l-2 border-destructive bg-destructive/8")}>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0"><h3 className="break-all font-mono text-sm font-semibold">{l.username}</h3>{isAdmin && <p className="mt-1 break-all text-xs text-muted-foreground">{l.profiles?.display_name ?? l.profiles?.email}</p>}{l.is_test && <p className="mt-1 text-xs text-muted-foreground">24H test</p>}</div>
                <StatusBadge active={isActive(l.expires_at)} />
              </div>
              <dl className="grid grid-cols-2 gap-3 text-xs">
                <div className="min-w-0"><dt className="text-muted-foreground">Password</dt><dd className="mt-1 break-all font-mono">{l.password}</dd></div>
                <div><dt className="text-muted-foreground">Expiry</dt><dd className="mt-1 font-mono">{fmtDate(l.expires_at)}</dd></div>
                <div className="col-span-2"><dt className="text-muted-foreground">Connections</dt><dd className="mt-1 flex items-center gap-2"><span className={cn("font-mono", full && "text-destructive")}>{live}/{max}</span>{full && <FullBadge max={max} />}</dd>
                {(l.active_devices ?? []).map((d, i) => <p key={i} className="mt-1 break-words text-muted-foreground">{d.label}</p>)}</div>
              </dl>
              {isAdmin && <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-border bg-muted/30">
                {copyItems(l).map((c, i) => <button key={c.label} type="button" title={c.title} onClick={() => copyLink(c.value, c.toast)} className={cn("flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium text-foreground transition-colors hover:bg-primary/10 active:bg-primary/15", i > 0 && "border-l border-border")}><Copy className="size-4 shrink-0 text-primary" /><span className="truncate">{c.short}</span></button>)}
              </div>}
              {!isAdmin && <Button variant="outline" className={softBtn} onClick={() => copyLink(`Host: ${customerLinks(l).provider}\nUsername: ${l.username}\nPassword: ${l.password}`, "Login details")}><Copy />Copy host & login</Button>}
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2">
                <select aria-label={`Renew months for ${l.username}`} className={inputCls} value={renewMonths[l.id] ?? 1} onChange={(e) => setRenewMonths({ ...renewMonths, [l.id]: Number(e.target.value) })}>{MONTHS.map((m) => <option key={m} value={m}>{m}m</option>)}</select>
                <Button variant="outline" className={cn(softBtn, "whitespace-normal px-2")} onClick={() => renew(l.id)}>{isAdmin ? "Renew" : `Renew · ${renewalCost(renewMonths[l.id] ?? 1, max)} credits`}</Button>
                <Button variant="outline" className={cn(softBtn, "size-11 p-0")} aria-label={`Edit ${l.username}`} title="Edit line" onClick={() => setEditing({ id: l.id, username: l.username, password: l.password, host: l.custom_host ?? "", expires: fmtDate(l.expires_at), maxConn: max })}><Pencil /></Button>
                <Button variant="outline" className={cn(dangerBtn, "size-11 p-0")} aria-label={`Delete ${l.username}`} title="Delete line" onClick={() => remove(l.id, l.username)}><Trash2 /></Button>
              </div>
            </article>;
          })}
          {!shown.length && <p className="px-4 py-6 text-muted-foreground">No lines found.</p>}
        </div>
        <div className="hidden overflow-x-auto xl:block">
          <table className="w-full text-[13px]">
            <thead>
              <tr>
                <th className={cn(th, "px-3 py-2 first:pl-4")}>Username</th>
                {isAdmin && <th className={cn(th, "px-3 py-2")}>Reseller</th>}
                <th className={cn(th, "px-3 py-2")}>Expiry</th>
                <th className={cn(th, "px-3 py-2")}>Conn.</th>
                <th className={cn(th, "px-3 py-2")}>Status</th>
                <th className={cn(th, "px-3 py-2")}>Copy</th>
                <th className={cn(th, "px-3 py-2 text-right last:pr-4")}>Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shown.map((l) => {
                const max = l.max_connections ?? 1;
                const live = l.active_connections ?? 0;
                const atLimit = live >= max;
                return (
                <tr
                  key={l.id}
                  data-full={atLimit ? "true" : undefined}
                  className={cn("transition-colors hover:bg-glass-strong", atLimit && "bg-destructive/8")}
                >
                  <td className={cn(td, "font-mono text-[12px]", atLimit && "border-l-2 border-l-destructive")}>
                    {l.username}
                    {l.is_test && <span className="ml-2 rounded-full border border-border px-1.5 py-0.5 font-sans text-[10px] text-muted-foreground" title={l.customer_contact ?? ""}>Test used</span>}
                  </td>
                  <td className={`${td} font-mono text-[12px] text-muted-foreground`}>{l.password}</td>
                  {isAdmin && <td className={`${td} text-muted-foreground`}>{l.profiles?.display_name ?? l.profiles?.email}</td>}
                  <td className={`${td} font-mono text-[12px]`}>{fmtDate(l.expires_at)}</td>
                  <td className={`${td} font-mono text-[12px]`}>
                    <span
                      title={`${l.active_connections ?? 0} device${(l.active_connections ?? 0) === 1 ? "" : "s"} streaming now · max ${l.max_connections ?? 1}${(l.active_devices ?? []).length ? "\n" + (l.active_devices ?? []).map((d) => d.label).join("\n") : ""}`}
                      className={cn("font-mono", atLimit && "font-semibold text-destructive")}
                    >
                      {live}/{max}
                    </span>
                    {atLimit && (
                      <div className="mt-1">
                        <FullBadge max={max} />
                      </div>
                    )}
                    {(l.active_devices ?? []).length > 0 && (
                      <div className="mt-1 space-y-0.5 font-sans text-[11px] text-muted-foreground">
                        {(l.active_devices ?? []).slice(0, 3).map((d, i) => (
                          <div key={i} className="truncate" title={d.label}>{d.label}</div>
                        ))}
                        {(l.active_devices ?? []).length > 3 && (
                          <div title={(l.active_devices ?? []).map((d) => d.label).join("\n")}>
                            +{(l.active_devices ?? []).length - 3} more
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className={td}><StatusBadge active={isActive(l.expires_at)} /></td>
                  <td className={td}>
                    {isAdmin ? <div className="inline-flex overflow-hidden rounded-lg border border-border bg-muted/30">
                      {copyItems(l).map((c, i) => <button key={c.label} type="button" title={c.title} onClick={() => copyLink(c.value, c.toast)} className={cn("inline-flex h-8 items-center gap-1 whitespace-nowrap px-2.5 text-[12px] font-medium text-foreground transition-colors hover:bg-primary/10 active:bg-primary/15", i > 0 && "border-l border-border")}><Copy className="size-3.5 text-primary" />{c.short}</button>)}
                    </div> : <Button type="button" variant="outline" className={softBtn} title="Copy host, username and password" onClick={() => copyLink(`Host: ${customerLinks(l).provider}\nUsername: ${l.username}\nPassword: ${l.password}`, "Login details")}><Copy className="size-3.5" /> Copy</Button>}
                  </td>
                  <td className={`${td} text-right`}>
                    <div className="inline-flex items-center gap-1.5">
                      <select
                        aria-label="Renew months"
                        className={`${inputCls} py-1`}
                        value={renewMonths[l.id] ?? 1}
                        onChange={(e) => setRenewMonths({ ...renewMonths, [l.id]: Number(e.target.value) })}
                      >
                        {MONTHS.map((m) => <option key={m} value={m}>{m}m</option>)}
                      </select>
                      <Button type="button" variant="outline" className={softBtn} onClick={() => renew(l.id)}>
                        {isAdmin ? "Renew" : `Renew · ${renewalCost(renewMonths[l.id] ?? 1, l.max_connections ?? 1)} credits`}
                      </Button>
                      <Button
                        className={softBtn}
                        aria-label={`Edit ${l.username}`}
                        onClick={() =>
                          setEditing({ id: l.id, username: l.username, password: l.password, host: l.custom_host ?? "", expires: fmtDate(l.expires_at), maxConn: l.max_connections ?? 1 })
                        }
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button className={dangerBtn} aria-label={`Delete ${l.username}`} onClick={() => remove(l.id, l.username)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
                );
              })}
              {!shown.length && (
                <tr><td className={`${td} text-muted-foreground`} colSpan={9}>No lines found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
