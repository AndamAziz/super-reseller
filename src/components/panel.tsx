import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", admin: false },
  { to: "/resellers", label: "Resellers", admin: true },
  { to: "/lines", label: "Lines", admin: false },
  { to: "/credits", label: "Credits", admin: false },
  { to: "/playlists", label: "Playlists", admin: false },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { data: me } = useMe();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const initials = (me?.displayName || me?.email || "?").slice(0, 2).toUpperCase();

  const sidebar = (
    <aside className="glass rise p-4 lg:sticky lg:top-6 lg:self-start">
      <div className="flex items-center gap-2.5 px-2 pb-4">
        <div className="grid size-8 place-items-center rounded-xl bg-primary font-display text-[13px] font-bold text-primary-foreground">
          N
        </div>
        <div className="leading-tight">
          <div className="font-display text-[14px] font-semibold">NIMBUS</div>
          <div className="label-mono tracking-[0.18em]">{me?.role === "admin" ? "Super Admin" : "Reseller Ops"}</div>
        </div>
        <button className="ml-auto lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
          <X className="size-4" />
        </button>
      </div>
      <nav className="flex flex-col gap-1">
        {NAV.filter((n) => !n.admin || me?.role === "admin").map((n) => {
          const active = path === n.to;
          return (
            <Link
              key={n.to}
              to={n.to}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center justify-between rounded-xl px-3 py-2 text-[13px] transition-colors",
                active
                  ? "bg-glass-strong font-medium ring-1 ring-border"
                  : "text-muted-foreground hover:bg-glass-strong hover:text-foreground",
              )}
            >
              <span>{n.label}</span>
              {active && <span className="font-mono text-[10px] text-primary">●</span>}
            </Link>
          );
        })}
      </nav>
      {me?.role === "reseller" && (
        <div className="mt-6 rounded-2xl border border-glass-edge bg-gradient-to-br from-primary/10 to-good/10 p-4">
          <div className="label-mono">Balance</div>
          <div className="mt-1 font-display text-[22px] font-semibold tracking-tight">{me.credits.toLocaleString()}</div>
          <div className="text-[11px] text-muted-foreground">credits available · 1 credit = 1 month</div>
        </div>
      )}
      <div className="mt-5 flex items-center gap-2.5 border-t border-border pt-4">
        <div className="grid size-8 place-items-center rounded-full bg-foreground font-display text-[11px] font-semibold text-primary-foreground">
          {initials}
        </div>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[12px] font-medium">{me?.email}</div>
          <div className="font-mono text-[10px] text-muted-foreground">{me?.role ?? "no role"}</div>
        </div>
        <button onClick={signOut} className="ml-auto rounded-lg p-1.5 text-muted-foreground hover:bg-glass-strong hover:text-foreground" aria-label="Sign out">
          <LogOut className="size-4" />
        </button>
      </div>
    </aside>
  );

  return (
    <div className="relative min-h-screen overflow-hidden text-sm">
      <div className="sheen-bg pointer-events-none absolute inset-0" />
      <div className="relative mx-auto max-w-[1440px] px-4 py-5 lg:px-8 lg:py-7">
        <div className="mb-4 flex items-center gap-3 lg:hidden">
          <button onClick={() => setOpen(true)} className="glass p-2" aria-label="Open menu">
            <Menu className="size-4" />
          </button>
          <span className="font-display font-semibold">NIMBUS</span>
        </div>
        <div className="grid gap-5 lg:grid-cols-[248px_minmax(0,1fr)]">
          <div className={cn("lg:block", open ? "fixed inset-0 z-50 bg-background/70 p-4 backdrop-blur-sm" : "hidden")}>
            {sidebar}
          </div>
          <main className="min-w-0 space-y-5">{children}</main>
        </div>
      </div>
    </div>
  );
}

export function PageHeader({ eyebrow, title, actions }: { eyebrow: string; title: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="label-mono tracking-[0.22em]">{eyebrow}</div>
        <h1 className="mt-1 text-balance font-display text-[26px] font-semibold tracking-tight">{title}</h1>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function StatCard({ label, value, hint, tone, delay = 0 }: { label: string; value: ReactNode; hint?: string; tone?: "good" | "warn"; delay?: number }) {
  return (
    <div className="glass rise p-5" style={{ animationDelay: `${delay}ms` }}>
      <div className="label-mono">{label}</div>
      <div className="mt-2 font-display text-[30px] font-semibold tracking-tight">{value}</div>
      {hint && (
        <div className={cn("mt-1 text-[11px]", tone === "good" ? "font-medium text-good" : tone === "warn" ? "font-medium text-warn" : "text-muted-foreground")}>
          {hint}
        </div>
      )}
    </div>
  );
}

export function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1",
        active ? "bg-good/10 text-good ring-good/20" : "bg-warn/10 text-warn ring-warn/20",
      )}
    >
      <span className={cn("size-1.5 rounded-full", active ? "bg-good" : "bg-warn")} />
      {active ? "Active" : "Expired"}
    </span>
  );
}

export function Panel({ title, sub, actions, children, className }: { title: string; sub?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("glass rise overflow-hidden", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="font-display text-[16px] font-semibold tracking-tight">{title}</h2>
          {sub && <div className="label-mono mt-0.5">{sub}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export const th = "label-mono px-4 py-3 text-left font-medium tracking-[0.14em] first:pl-5 last:pr-5";
export const td = "px-4 py-3 first:pl-5 last:pr-5";
export const inputCls =
  "rounded-lg border border-glass-edge bg-glass-strong px-3 py-1.5 text-[12px] outline-none ring-1 ring-border placeholder:text-muted-foreground focus:ring-ring";
export const softBtn =
  "rounded-lg border border-primary/25 bg-primary/10 px-3 py-1 text-[12px] font-medium text-primary transition-colors hover:bg-primary/15 disabled:opacity-50";
export const dangerBtn =
  "rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-1 text-[12px] font-medium text-destructive transition-colors hover:bg-destructive/15 disabled:opacity-50";
export const primaryBtn =
  "rounded-xl bg-primary px-4 py-2 font-display text-[13px] font-semibold text-primary-foreground ring-1 ring-border transition-colors hover:bg-primary/90 disabled:opacity-50";

export function FullBadge({ max }: { max: number }) {
  return (
    <span
      title={`All ${max} connection${max === 1 ? "" : "s"} in use — new devices are blocked until one stops`}
      className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive ring-1 ring-destructive/25"
    >
      <span className="size-1.5 rounded-full bg-destructive" />
      Full
    </span>
  );
}

