import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { inputCls, primaryBtn } from "@/components/panel";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Nimbus Panel" },
      { name: "description", content: "Sign in to the Nimbus reseller and admin panel." },
      { property: "og:title", content: "Sign in — Nimbus Panel" },
      { property: "og:description", content: "Sign in to the Nimbus reseller and admin panel." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) return setError(error.message);
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div className="sheen-bg pointer-events-none absolute inset-0" />
      <form onSubmit={submit} className="glass rise relative w-full max-w-sm space-y-4 p-7">
        <div className="flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-xl bg-primary font-display font-bold text-primary-foreground">N</div>
          <div className="leading-tight">
            <div className="font-display text-[15px] font-semibold">NIMBUS</div>
            <div className="label-mono tracking-[0.18em]">Reseller Ops</div>
          </div>
        </div>
        <h1 className="pt-2 font-display text-xl font-semibold tracking-tight">Sign in to your panel</h1>
        <label className="block space-y-1.5">
          <span className="label-mono">Email</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={`${inputCls} w-full py-2 text-[13px]`} />
        </label>
        <label className="block space-y-1.5">
          <span className="label-mono">Password</span>
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputCls} w-full py-2 text-[13px]`} />
        </label>
        {error && <p className="text-[12px] text-destructive">{error}</p>}
        <button disabled={busy} className={`${primaryBtn} w-full py-2.5`}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="text-center text-[11px] text-muted-foreground">Reseller accounts are created by your administrator.</p>
      </form>
    </div>
  );
}
