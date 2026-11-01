import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader, Panel, StatCard, StatusBadge, td, th, primaryBtn } from "@/components/panel";
import { useMe, isActive, fmtDate } from "@/hooks/use-me";
import { useLines, usePlaylists, useResellers } from "@/lib/queries";
import { AlertTriangle } from "lucide-react";
import { hasLowCredits } from "@/lib/credit-alert";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Kurdistan IPTV" },
    { name: "description", content: "Monitor Kurdistan IPTV subscriptions, credits and expirations." },
    { property: "og:title", content: "Dashboard — Kurdistan IPTV" },
    { property: "og:description", content: "Monitor Kurdistan IPTV subscriptions, credits and expirations." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Dashboard,
});

function Dashboard() {
  const { data: me } = useMe();
  const isAdmin = me?.role === "admin";
  const { data: lines = [] } = useLines();
  const { data: playlists = [] } = usePlaylists();
  const resellers = useResellers();
  const active = lines.filter((l) => isActive(l.expires_at)).length;
  const soon = lines.filter((l) => {
    const t = new Date(l.expires_at).getTime() - Date.now();
    return t > 0 && t < 7 * 864e5;
  }).length;
  const creditsOut = (resellers.data ?? []).reduce((s, r) => s + r.credits, 0);
  const lowBalanceCount = (resellers.data ?? []).filter((r) => hasLowCredits("reseller", r.credits)).length;

  return (
    <>
      <PageHeader
        eyebrow={`overview · ${new Date().toISOString().slice(11, 16)} utc`}
        title={isAdmin ? "System health" : `Welcome, ${me?.displayName ?? "reseller"}`}
        actions={
          <>
            <div className="flex items-center gap-2 rounded-xl border border-glass-edge bg-glass-strong px-3 py-2 ring-1 ring-border">
              <span className="pulse-dot size-2 rounded-full bg-good" />
              <span className="font-mono text-[11px] text-muted-foreground">live · {active} active lines</span>
            </div>
            <Link to="/lines" className={primaryBtn}>New line</Link>
            {isAdmin && <Link to="/youtube-episodes" className="text-sm font-medium text-primary">YouTube Episode Manager →</Link>}
          </>
        }
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isAdmin ? (
          <StatCard label="Resellers" value={resellers.data?.length ?? 0} delay={60} />
        ) : (
          <StatCard label="Credit balance" value={me?.credits ?? 0} hint="1 credit = 1 month" tone="good" delay={60} />
        )}
        <StatCard label="Active lines" value={active} hint={`of ${lines.length} total`} delay={120} />
        <StatCard label="Expired lines" value={lines.length - active} hint={`${soon} expire within 7d`} tone="warn" delay={180} />
        {isAdmin ? (
          <StatCard label="Credits held" value={creditsOut} hint="across all resellers" delay={240} />
        ) : (
          <StatCard label="Lines" value={lines.length} delay={240} />
        )}
      </section>

      {isAdmin && (
        <Panel title="Reseller credit balances" sub={`${lowBalanceCount} low-credit ${lowBalanceCount === 1 ? "account" : "accounts"}`} actions={<Link to="/resellers" className="text-[12px] font-medium text-primary">Manage resellers →</Link>}>
          <div className="overflow-x-auto">
            <table aria-label="Reseller credit balances" className="w-full min-w-[480px] text-[13px]">
              <thead>
                <tr>
                  <th className={th}>Reseller</th>
                  <th className={th}>Credit balance</th>
                  <th className={th}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(resellers.data ?? []).map((r) => {
                  const low = hasLowCredits("reseller", r.credits);
                  return (
                    <tr key={r.id} className={low ? "bg-warn/5" : "transition-colors hover:bg-glass-strong"}>
                      <td className={td}>
                        <div className="font-medium">{r.display_name || r.email}</div>
                        {r.display_name && <div className="mt-0.5 text-[11px] text-muted-foreground">{r.email}</div>}
                      </td>
                      <td className={`${td} font-mono tabular-nums ${low ? "font-semibold text-warn" : "text-foreground"}`}>{r.credits} credits</td>
                      <td className={td}>
                        {low ? (
                          <span role="status" className="inline-flex items-center gap-1.5 rounded-md bg-warn/10 px-2 py-1 text-[11px] font-medium text-warn ring-1 ring-warn/20">
                            <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />Low credits
                          </span>
                        ) : <span className="text-[12px] text-muted-foreground">Sufficient credits</span>}
                      </td>
                    </tr>
                  );
                })}
                {resellers.isPending && <tr><td colSpan={3} className={`${td} text-muted-foreground`}>Loading reseller balances…</td></tr>}
                {resellers.isError && <tr><td colSpan={3} role="alert" className={`${td} text-destructive`}>Could not load reseller balances.</td></tr>}
                {resellers.isSuccess && !resellers.data.length && <tr><td colSpan={3} className={`${td} text-muted-foreground`}>No resellers yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <Panel title="Recent subscription lines" sub={`${active} active · ${lines.length - active} expired`} actions={<Link to="/lines" className="text-[12px] font-medium text-primary">View all →</Link>}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead>
              <tr>
                <th className={th}>Username</th>
                {isAdmin && <th className={th}>Reseller</th>}
                <th className={th}>Expiry</th>
                <th className={th}>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lines.slice(0, 6).map((l) => (
                <tr key={l.id} className="transition-colors hover:bg-glass-strong">
                  <td className={`${td} font-mono text-[12px]`}>{l.username}</td>
                  {isAdmin && <td className={`${td} text-muted-foreground`}>{l.profiles?.display_name ?? l.profiles?.email}</td>}
                  <td className={`${td} font-mono text-[12px]`}>{fmtDate(l.expires_at)}</td>
                  <td className={td}><StatusBadge active={isActive(l.expires_at)} /></td>
                </tr>
              ))}
              {!lines.length && (
                <tr><td className={`${td} text-muted-foreground`} colSpan={4}>No lines yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
