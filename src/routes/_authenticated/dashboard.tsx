import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader, Panel, StatCard, StatusBadge, td, th, primaryBtn } from "@/components/panel";
import { useMe, isActive, fmtDate } from "@/hooks/use-me";
import { useLines, usePlaylists, useResellers } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Nimbus Panel" }] }),
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
          <StatCard label="Playlists" value={playlists.length} delay={240} />
        )}
      </section>

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
