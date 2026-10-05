import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Copy, Link2, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Panel, StatusBadge, td, th, inputCls, softBtn, dangerBtn, primaryBtn } from "@/components/panel";
import { useMe, isActive, fmtDate, errMsg } from "@/hooks/use-me";
import { useLines } from "@/lib/queries";
import { createLine, deleteLine, renewLine, updateLine } from "@/lib/lines.functions";

export const Route = createFileRoute("/_authenticated/lines")({
  head: () => ({ meta: [{ title: "Lines — Nimbus Panel" }] }),
  component: LinesPage,
});

const schema = z.object({
  username: z.string().trim().min(3, "Username: min 3 chars").max(50).regex(/^[\w.-]+$/, "Username: letters, numbers, . _ - only"),
  password: z.string().min(4, "Password: min 4 chars").max(100),
  months: z.number().int().min(1).max(24),
});

const MONTHS = [1, 3, 6, 12];

function LinesPage() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const isAdmin = me?.role === "admin";
  const { data: lines = [] } = useLines();
  const createLineFn = useServerFn(createLine);
  const renewLineFn = useServerFn(renewLine);
  const deleteLineFn = useServerFn(deleteLine);
  const updateLineFn = useServerFn(updateLine);
  const [form, setForm] = useState({ username: "", password: "", months: 1, host: "" });
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "expired">("all");
  const [renewMonths, setRenewMonths] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<{ id: string; username: string; password: string; host: string; expires: string } | null>(null);
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

  const linkFor = (l: { username: string; password: string; custom_host: string | null }) => {
    let base = (l.custom_host || (typeof window !== "undefined" ? window.location.origin : "")).trim().replace(/\/+$/, "");
    if (base && !/^https?:\/\//i.test(base)) base = `https://${base}`;
    return `${base}/api/public/playlist?username=${encodeURIComponent(l.username)}&password=${encodeURIComponent(l.password)}`;
  };

  async function copyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("M3U link copied");
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
      await updateLineFn({
        data: {
          lineId: editing.id,
          password: editing.password,
          customHost: editing.host.trim() || null,
          expiresAt: isAdmin && editing.expires ? new Date(`${editing.expires}T23:59:59Z`).toISOString() : null,
        },
      });
      toast.success("Line updated");
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

  async function runPanelTest() {
    setTesting(true);
    setPanelTest(null);
    try {
      const res = await testPanelFn();
      setPanelTest(res);
      if (res.ok) toast.success("Panel connection OK");
      else toast.error("Panel connection failed — see details below");
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setTesting(false);
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) return void toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
    setBusy(true);
    try {
      const res = await createLineFn({ data: { ...parsed.data, ...(form.host.trim() ? { customHost: form.host.trim() } : {}) } });
      if (res.panelStatus === "synced") {
        toast.success(`Line ${parsed.data.username} created and synced to panel`);
      } else if (res.panelStatus === "error") {
        toast.warning(`Line ${parsed.data.username} created, but the panel rejected it: ${res.panelMessage ?? "unknown error"}`);
      } else {
        toast.success(`Line ${parsed.data.username} created`);
      }
      setForm({ username: "", password: "", months: 1, host: "" });
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
  const cost = isAdmin ? 0 : form.months;

  return (
    <>
      <PageHeader eyebrow="customers" title="Subscription lines" />

      <div className="glass rise space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="label-mono">Xtream panel</p>
            <p className="text-[12px] text-muted-foreground">Check the saved panel URL and API before creating or renewing lines.</p>
          </div>
          <button type="button" onClick={runPanelTest} disabled={testing} className={softBtn}>
            {testing ? "Testing…" : "Test panel connection"}
          </button>
        </div>
        {panelTest && (
          <div className="space-y-1.5 border-t border-border pt-3">
            {panelTest.checks.map((c) => (
              <div key={c.name} className="flex items-baseline gap-2 text-[12px]">
                <span className={c.ok ? "text-good" : "text-destructive"}>{c.ok ? "✓" : "✗"}</span>
                <span className="font-medium">{c.name}</span>
                <span className="font-mono text-[11px] text-muted-foreground">{c.detail}</span>
              </div>
            ))}
            {panelTest.ok ? (
              <p className="pt-1 text-[12px] text-good">Panel is reachable and credentials are accepted — new lines will sync automatically.</p>
            ) : (
              <p className="pt-1 text-[12px] text-destructive">Fix the failing step above, then test again. Lines can still be created locally, but they won't reach the panel.</p>
            )}
          </div>
        )}
      </div>

      {isAdmin && (
        <form onSubmit={saveSource} className="glass rise flex flex-wrap items-end gap-3 p-5">
          <label className="min-w-[240px] flex-1 space-y-1.5">
            <span className="label-mono inline-flex items-center gap-1.5"><Link2 className="size-3.5" /> Protected M3U source</span>
            <input
              className={`${inputCls} w-full py-2 font-mono text-[12px]`}
              placeholder="https://…/playlist.m3u"
              value={source ?? ""}
              onChange={(e) => setSource(e.target.value)}
            />
            <span className="block text-[11px] text-muted-foreground">Clients never see this address — they get their own link that checks username, password and expiry.</span>
          </label>
          <button className={primaryBtn}>Save source</button>
        </form>
      )}

      <form onSubmit={create} className="glass rise grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto_auto] lg:items-end">
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
            {MONTHS.map((m) => <option key={m} value={m}>{m} month{m > 1 ? "s" : ""}</option>)}
          </select>
        </label>
        <button disabled={busy} className={primaryBtn}>
          {busy ? "Creating…" : isAdmin ? "Create line" : `Create · ${cost} credit${cost > 1 ? "s" : ""}`}
        </button>
        {!isAdmin && (
          <p className="text-[11px] text-muted-foreground sm:col-span-2 lg:col-span-5">
            Balance: <span className="font-mono">{me?.credits ?? 0}</span> credits · 1 credit = 1 month
          </p>
        )}
      </form>

      {editing && (
        <form onSubmit={saveEdit} className="glass rise grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto_auto] lg:items-end">
          <p className="label-mono sm:col-span-2 lg:col-span-5">Edit line · {editing.username}</p>
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
          <button className={primaryBtn}>Save</button>
          <button type="button" className={softBtn} onClick={() => setEditing(null)}>Cancel</button>
        </form>
      )}

      <Panel
        title="All lines"
        sub={`${active} active · ${lines.length - active} expired`}
        actions={
          <>
            <input placeholder="search username or reseller" value={q} onChange={(e) => setQ(e.target.value)} className={`${inputCls} w-48`} />
            <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className={inputCls}>
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
            </select>
          </>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-[13px]">
            <thead>
              <tr>
                <th className={th}>Username</th>
                <th className={th}>Password</th>
                {isAdmin && <th className={th}>Reseller</th>}
                <th className={th}>Expiry</th>
                <th className={th}>Status</th>
                <th className={th}>Link</th>
                <th className={th}>Panel</th>
                <th className={`${th} text-right`}>Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shown.map((l) => (
                <tr key={l.id} className="transition-colors hover:bg-glass-strong">
                  <td className={`${td} font-mono text-[12px]`}>{l.username}</td>
                  <td className={`${td} font-mono text-[12px] text-muted-foreground`}>{l.password}</td>
                  {isAdmin && <td className={`${td} text-muted-foreground`}>{l.profiles?.display_name ?? l.profiles?.email}</td>}
                  <td className={`${td} font-mono text-[12px]`}>{fmtDate(l.expires_at)}</td>
                  <td className={td}><StatusBadge active={isActive(l.expires_at)} /></td>
                  <td className={td}>
                    <button
                      type="button"
                      className={`${softBtn} inline-flex items-center gap-1`}
                      title={linkFor(l)}
                      onClick={() => copyLink(linkFor(l))}
                    >
                      <Copy className="size-3.5" /> M3U
                    </button>
                  </td>
                  <td className={`${td} font-mono text-[11px]`}>
                    {l.panel_status === "synced" ? (
                      <span className="text-good">synced</span>
                    ) : l.panel_status === "error" ? (
                      <span className="text-destructive" title={l.panel_message ?? undefined}>error</span>
                    ) : (
                      <span className="text-muted-foreground">local</span>
                    )}
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
                      <button className={softBtn} onClick={() => renew(l.id)}>Renew</button>
                      <button
                        className={softBtn}
                        aria-label={`Edit ${l.username}`}
                        onClick={() =>
                          setEditing({ id: l.id, username: l.username, password: l.password, host: l.custom_host ?? "", expires: fmtDate(l.expires_at) })
                        }
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button className={dangerBtn} aria-label={`Delete ${l.username}`} onClick={() => remove(l.id, l.username)}>
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!shown.length && (
                <tr><td className={`${td} text-muted-foreground`} colSpan={8}>No lines found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
