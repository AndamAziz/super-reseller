import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { inputCls, primaryBtn, TelegramIcon, TELEGRAM_HANDLE, TELEGRAM_URL } from "@/components/panel";
import logoAsset from "@/assets/kurdistan-iptv-logo.png.asset.json";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Kurdistan IPTV" },
      { name: "description", content: "Sign in to the Kurdistan IPTV reseller and admin panel." },
      { property: "og:title", content: "Sign in — Kurdistan IPTV" },
      { property: "og:description", content: "Sign in to the Kurdistan IPTV reseller and admin panel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
          <img src={logoAsset.url} alt="Kurdistan IPTV" className="size-10 rounded-xl object-cover ring-1 ring-border" />
          <div className="leading-tight">
            <div className="font-display text-[15px] font-semibold">KURDISTAN IPTV</div>
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
        <a
          href={TELEGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-xl border border-glass-edge bg-glass-strong px-3 py-2 text-[12px] text-muted-foreground ring-1 ring-border transition-colors hover:text-foreground"
        >
          <TelegramIcon className="size-4 text-primary" />
          Need an account or help? Chat on Telegram @{TELEGRAM_HANDLE}
        </a>
      </form>
    </div>
  );
}
