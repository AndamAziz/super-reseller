import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel, StatCard, td, th } from "@/components/panel";
import { useMe } from "@/hooks/use-me";
import { useTransactions } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/credits")({
  head: () => ({ meta: [{ title: "Credits — Kurdistan IPTV" }] }),
  component: CreditsPage,
});

function CreditsPage() {
  const { data: me } = useMe();
  const isAdmin = me?.role === "admin";
  const { data: tx = [] } = useTransactions();
  const issued = tx.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const spent = tx.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0);

  return (
    <>
      <PageHeader eyebrow="ledger" title="Credits" />
      <section className="grid gap-4 sm:grid-cols-3">
        {!isAdmin && <StatCard label="Balance" value={me?.credits ?? 0} hint="1 credit = 1 month" tone="good" />}
        <StatCard label="Credits received" value={issued} delay={60} />
        <StatCard label="Credits spent" value={spent} delay={120} tone="warn" hint="on new lines & renewals" />
      </section>
      <Panel title="Transaction history" sub={`latest ${tx.length}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-[13px]">
            <thead>
              <tr>
                <th className={th}>Date</th>
                {isAdmin && <th className={th}>Reseller</th>}
                <th className={th}>Reason</th>
                <th className={`${th} text-right`}>Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tx.map((t) => (
                <tr key={t.id} className="hover:bg-glass-strong">
                  <td className={`${td} font-mono text-[12px]`}>{new Date(t.created_at).toISOString().slice(0, 16).replace("T", " ")}</td>
                  {isAdmin && <td className={`${td} text-muted-foreground`}>{t.profiles?.display_name ?? t.profiles?.email}</td>}
                  <td className={td}>{t.reason}</td>
                  <td className={cn(td, "text-right font-mono", t.amount > 0 ? "text-good" : "text-warn")}>
                    {t.amount > 0 ? `+${t.amount}` : t.amount}
                  </td>
                </tr>
              ))}
              {!tx.length && <tr><td className={`${td} text-muted-foreground`} colSpan={4}>No transactions yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
