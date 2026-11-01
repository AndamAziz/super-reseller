import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createReseller, deleteReseller } from "@/lib/admin.functions";
import { PageHeader, Panel, td, th, inputCls, softBtn, dangerBtn, primaryBtn } from "@/components/panel";
import { useMe, fmtDate, errMsg, isActive } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { Plus, Minus, Trash2 } from "lucide-react";
import { useLines, useResellers } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/resellers")({
  head: () => ({ meta: [{ title: "Resellers — Kurdistan IPTV" },
    { name: "description", content: "Manage Kurdistan IPTV reseller accounts and credit allocations." },
    { property: "og:title", content: "Resellers — Kurdistan IPTV" },
    { property: "og:description", content: "Manage Kurdistan IPTV reseller accounts and credit allocations." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: ResellersPage,
});

function ResellersPage() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const { data: resellers = [] } = useResellers();
  const { data: lines = [] } = useLines();
  const createFn = useServerFn(createReseller);
  const deleteFn = useServerFn(deleteReseller);
  const [form, setForm] = useState({ displayName: "", email: "", password: "", credits: 0 });
  const [busy, setBusy] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  if (me && me.role !== "admin") return <p className="text-muted-foreground">Admins only.</p>;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["resellers"] });
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["lines"] });
  };

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await createFn({ data: { ...form, credits: Number(form.credits) || 0 } });
      toast.success(`Reseller ${form.email} created`);
      setForm({ displayName: "", email: "", password: "", credits: 0 });
      refresh();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function adjust(id: string, sign: 1 | -1) {
    const n = parseInt(amounts[id] ?? "", 10);
    if (!n || n < 1) return void toast.error("Enter a positive amount");
    const { error } = await supabase.rpc("adjust_credits", { _reseller_id: id, _amount: n * sign, _reason: "" });
    if (error) return void toast.error(error.message);
    toast.success(`${sign > 0 ? "Added" : "Removed"} ${n} credits`);
    setAmounts({ ...amounts, [id]: "" });
    refresh();
  }

  async function remove(id: string, email: string) {
    if (!confirm(`Delete reseller ${email} and all their lines?`)) return;
    try {
      await deleteFn({ data: { id } });
      toast.success("Reseller deleted");
      refresh();
    } catch (err) {
      toast.error(errMsg(err));
    }
  }

  return (
    <>
      <PageHeader eyebrow="accounts" title="Resellers" />
      <form onSubmit={create} className="rise grid gap-4 border-y border-border bg-glass px-4 py-5 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_110px_auto] lg:items-end">
        {(
          [
            ["displayName", "Name", "text"],
            ["email", "Email", "email"],
            ["password", "Password (min 6)", "text"],
            ["credits", "Credits", "number"],
          ] as const
        ).map(([k, label, type]) => (
          <label key={k} className="min-w-0 space-y-1.5">
            <span className="label-mono">{label}</span>
            <input
              required
              type={type}
              min={type === "number" ? 0 : undefined}
              className={`${inputCls} w-full py-2`}
              value={form[k]}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
            />
          </label>
        ))}
        <Button disabled={busy} className={primaryBtn}>{busy ? "Creating…" : "Create reseller"}</Button>
      </form>

      <Panel title="Reseller accounts" sub={`${resellers.length} accounts`}>
        <div className="divide-y divide-border xl:hidden">
          {resellers.map((r) => {
            const own = lines.filter((l) => l.reseller_id === r.id);
            const act = own.filter((l) => isActive(l.expires_at)).length;
            return <article key={r.id} className="min-w-0 space-y-4 px-4 py-5">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0"><h3 className="break-words font-semibold">{r.display_name || r.email}</h3><p className="mt-1 break-all text-xs text-muted-foreground">{r.email}</p></div>
                <Button variant="outline" className={`${dangerBtn} size-11 p-0`} title="Delete reseller" aria-label={`Delete ${r.display_name || r.email}`} onClick={() => remove(r.id, r.email)}><Trash2 /></Button>
              </div>
              <dl className="grid grid-cols-3 gap-2 text-xs">
                <div><dt className="text-muted-foreground">Credits</dt><dd className="mt-1 font-mono text-lg text-primary">{r.credits.toLocaleString()}</dd></div>
                <div><dt className="text-muted-foreground">Active / total</dt><dd className="mt-1 font-mono text-lg">{act} / {own.length}</dd></div>
                <div><dt className="text-muted-foreground">Created</dt><dd className="mt-2 font-mono">{fmtDate(r.created_at)}</dd></div>
              </dl>
              <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2">
                <input type="number" inputMode="numeric" min={1} aria-label={`Credit amount for ${r.display_name || r.email}`} placeholder="Credits" className={`${inputCls} w-full`} value={amounts[r.id] ?? ""} onChange={(e) => setAmounts({ ...amounts, [r.id]: e.target.value })} />
                <Button variant="outline" className={softBtn} onClick={() => adjust(r.id, 1)}><Plus />Add</Button>
                <Button variant="outline" className={softBtn} onClick={() => adjust(r.id, -1)}><Minus />Remove</Button>
              </div>
            </article>;
          })}
          {!resellers.length && <p className="px-4 py-6 text-muted-foreground">No resellers yet.</p>}
        </div>
        <div className="hidden overflow-x-auto xl:block">
          <table className="w-full min-w-[860px] text-[13px]">
            <thead>
              <tr>
                <th className={th}>Reseller</th>
                <th className={th}>Credits</th>
                <th className={th}>Lines</th>
                <th className={th}>Created</th>
                <th className={`${th} text-right`}>Manage credits</th>
                <th className={`${th} text-right`}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {resellers.map((r) => {
                const own = lines.filter((l) => l.reseller_id === r.id);
                const act = own.filter((l) => isActive(l.expires_at)).length;
                return (
                  <tr key={r.id} className="transition-colors hover:bg-glass-strong">
                    <td className={td}>
                      <div className="font-medium">{r.display_name}</div>
                      <div className="text-[11px] text-muted-foreground">{r.email}</div>
                    </td>
                    <td className={`${td} font-mono text-primary`}>{r.credits.toLocaleString()}</td>
                    <td className={`${td} font-mono text-[12px]`}>
                      <span className="text-good">{act}</span> / {own.length}
                    </td>
                    <td className={`${td} font-mono text-[12px]`}>{fmtDate(r.created_at)}</td>
                    <td className={`${td} text-right`}>
                      <div className="inline-flex items-center gap-1.5">
                        <input
                          type="number"
                          min={1}
                          placeholder="qty"
                          className={`${inputCls} w-20 py-1`}
                          value={amounts[r.id] ?? ""}
                          onChange={(e) => setAmounts({ ...amounts, [r.id]: e.target.value })}
                        />
                        <Button className={softBtn} onClick={() => adjust(r.id, 1)}>+ Add</Button>
                        <Button className={softBtn} onClick={() => adjust(r.id, -1)}>− Remove</Button>
                      </div>
                    </td>
                    <td className={`${td} text-right`}>
                      <Button className={dangerBtn} onClick={() => remove(r.id, r.email)}>Delete</Button>
                    </td>
                  </tr>
                );
              })}
              {!resellers.length && (
                <tr><td className={`${td} text-muted-foreground`} colSpan={6}>No resellers yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
