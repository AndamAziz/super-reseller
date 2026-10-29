import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { AlertTriangle, LogOut, Menu, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { cn } from "@/lib/utils";
import logoAsset from "@/assets/kurdistan-iptv-logo.png.asset.json";
import { hasLowCredits, LOW_CREDIT_THRESHOLD } from "@/lib/credit-alert";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/dashboard", label: "Dashboard", admin: false },
  { to: "/resellers", label: "Resellers", admin: true },
  { to: "/lines", label: "Lines", admin: false },
  { to: "/credits", label: "Credits", admin: false },
  { to: "/playlists", label: "Playlists", admin: false },
  { to: "/contact", label: "Contact", admin: false },
] as const;

export const TELEGRAM_HANDLE = "AndamAziz";
export const TELEGRAM_URL = `https://t.me/${TELEGRAM_HANDLE}`;

export function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}


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
  const lowCredits = hasLowCredits(me?.role, me?.credits ?? 0);

  const sidebar = (
    <aside className="glass rise p-4 lg:sticky lg:top-6 lg:self-start">
      <div className="flex items-center gap-2.5 px-2 pb-4">
        <img src={logoAsset.url} alt="Kurdistan IPTV" className="size-9 rounded-xl object-cover ring-1 ring-border" />
        <div className="leading-tight">
          <div className="font-display text-[14px] font-semibold">KURDISTAN IPTV</div>
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
          <div className={cn("mt-1 font-display text-[22px] font-semibold tracking-tight", lowCredits && "text-warn")}>{me.credits.toLocaleString()}</div>
          {lowCredits && <div className="mt-1 inline-flex items-center gap-1 text-[12px] font-medium text-warn"><AlertTriangle className="size-3.5" /> Low credits</div>}
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
          <img src={logoAsset.url} alt="Kurdistan IPTV" className="size-7 rounded-lg object-cover ring-1 ring-border" />
          <span className="font-display font-semibold">KURDISTAN IPTV</span>
        </div>
        <div className="grid gap-5 lg:grid-cols-[248px_minmax(0,1fr)]">
          <div className={cn("lg:block", open ? "fixed inset-0 z-50 bg-background/70 p-4 backdrop-blur-sm" : "hidden")}>
            {sidebar}
          </div>
          <main className="min-w-0 space-y-5">
            {lowCredits && (
              <div role="alert" className="flex flex-wrap items-center gap-3 border-y border-warn/30 bg-warn/10 px-4 py-3 text-warn">
                <AlertTriangle className="size-5 shrink-0" aria-hidden="true" />
                <div className="min-w-0 flex-1 basis-48">
                  <p className="font-semibold">Low credit balance · {me?.credits ?? 0} credits remaining</p>
                  <p className="mt-0.5 text-[12px]">Your balance is below {LOW_CREDIT_THRESHOLD} credits. Contact support to top up.</p>
                </div>
                <Button asChild variant="outline" size="sm" className="border-warn/40 text-warn">
                  <Link to="/contact">Top up credits</Link>
                </Button>
              </div>
            )}
            {children}
          </main>
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

