import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { PageHeader, Panel, StatusBadge, td, th, inputCls, softBtn, dangerBtn, primaryBtn } from "@/components/panel";
import { useMe, isActive, fmtDate, errMsg } from "@/hooks/use-me";
import { useLines } from "@/lib/queries";
import { createLine, deleteLine, renewLine, testPanel } from "@/lib/lines.functions";
import type { PanelTestResult } from "@/lib/xtream.server";

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
  const testPanelFn = useServerFn(testPanel);
  const [panelTest, setPanelTest] = useState<PanelTestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", months: 1 });
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "expired">("all");
  const [renewMonths, setRenewMonths] = useState<Record<string, number>>({});

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
      const res = await testPanelFn({ data: {} });
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
      const res = await createLineFn({ data: parsed.data });
      if (res.panelStatus === "synced") {
        toast.success(`Line ${parsed.data.username} created and synced to panel`);
      } else if (res.panelStatus === "error") {
        toast.warning(`Line ${parsed.data.username} created, but the panel rejected it: ${res.panelMessage ?? "unknown error"}`);
      } else {
        toast.success(`Line ${parsed.data.username} created`);
      }
      setForm({ username: "", password: "", months: 1 });
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

      <form onSubmit={create} className="glass rise grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto] lg:items-end">
        <label className="space-y-1.5">
          <span className="label-mono">Username</span>
          <input className={`${inputCls} w-full py-2`} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        </label>
        <label className="space-y-1.5">
          <span className="label-mono">Password</span>
          <input className={`${inputCls} w-full py-2`} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
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
          <p className="text-[11px] text-muted-foreground sm:col-span-2 lg:col-span-4">
            Balance: <span className="font-mono">{me?.credits ?? 0}</span> credits · 1 credit = 1 month
          </p>
        )}
      </form>

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
                      <button className={dangerBtn} onClick={() => remove(l.id, l.username)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!shown.length && (
                <tr><td className={`${td} text-muted-foreground`} colSpan={7}>No lines found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
