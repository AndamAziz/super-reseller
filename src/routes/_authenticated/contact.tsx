import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Copy, Send } from "lucide-react";
import { toast } from "sonner";
import {
  PageHeader,
  Panel,
  TelegramIcon,
  TELEGRAM_HANDLE,
  TELEGRAM_URL,
  inputCls,
  primaryBtn,
  softBtn,
} from "@/components/panel";
import { useMe } from "@/hooks/use-me";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/contact")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Contact — Kurdistan IPTV" },
      { name: "description", content: "Reach Kurdistan IPTV support on Telegram: @AndamAziz." },
      { property: "og:title", content: "Contact — Kurdistan IPTV" },
      { property: "og:description", content: "Reach Kurdistan IPTV support on Telegram: @AndamAziz." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContactPage,
});

const TOPICS = [
  { id: "topup", label: "Credit top-up", hint: "I need more credits on my account." },
  { id: "new", label: "New line / subscription", hint: "I want to open a new customer line." },
  { id: "renew", label: "Renewal & expiry", hint: "I need help renewing a line or fixing an expiry date." },
  { id: "playback", label: "Playback problem", hint: "A channel, movie or series will not play." },
  { id: "devices", label: "Max connections", hint: "I need to change how many devices can watch at once." },
  { id: "other", label: "Something else", hint: "I have a question about my account." },
] as const;

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    document.body.removeChild(ta);
    return ok;
  }
}

function ContactPage() {
  const { data: me } = useMe();
  const [topicId, setTopicId] = useState<string>("topup");
  const [note, setNote] = useState("");
  const [copiedHandle, setCopiedHandle] = useState(false);

  const topic = TOPICS.find((t) => t.id === topicId) ?? TOPICS[0];

  const message = [
    `Hello @${TELEGRAM_HANDLE} — ${topic.hint}`,
    me?.email ? `My account: ${me.email}` : "",
    me?.role === "reseller" ? `Balance: ${me.credits} credit${me.credits === 1 ? "" : "s"}` : "",
    note.trim() ? `Details: ${note.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  async function copyHandle() {
    const ok = await copyText(`@${TELEGRAM_HANDLE}`);
    if (ok) {
      setCopiedHandle(true);
      setTimeout(() => setCopiedHandle(false), 1800);
      toast.success(`@${TELEGRAM_HANDLE} copied`);
    } else {
      toast.error("Could not copy — you can type it manually");
    }
  }

  async function openTelegram() {
    const ok = await copyText(message);
    if (ok) toast.success("Your message is copied — paste it into Telegram");
    else toast("Telegram opened — type your message there");
    window.open(TELEGRAM_URL, "_blank", "noopener,noreferrer");
  }

  return (
    <>
      <PageHeader
        eyebrow="support"
        title="Contact"
        actions={
          <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className={softBtn}>
            <TelegramIcon className="size-3.5" /> Telegram
          </a>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Panel title="Write to us on Telegram" sub={`one tap — we reply to @${TELEGRAM_HANDLE}`}>
          <div className="space-y-5 p-5">
            <div>
              <div className="label-mono">What do you need?</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {TOPICS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTopicId(t.id)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-[12px] ring-1 transition-colors",
                      topicId === t.id
                        ? "bg-primary font-medium text-primary-foreground ring-primary/40"
                        : "bg-glass-strong text-muted-foreground ring-border hover:text-foreground",
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="block space-y-1.5">
              <span className="label-mono">Add details (optional)</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Username, channel name, device model, or anything else we should know…"
                className={`${inputCls} w-full resize-y py-2 text-[13px]`}
              />
            </label>

            <div className="rounded-2xl border border-glass-edge bg-glass-strong/60 p-4">
              <div className="label-mono">Your message</div>
              <pre className="mt-1.5 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
                {message}
              </pre>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button onClick={openTelegram} className={primaryBtn}>
                <Send className="mr-1.5 inline size-3.5" /> Copy message & open Telegram
              </button>
              <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className={softBtn}>
                <TelegramIcon className="size-3.5" /> Open chat without copying
              </a>
            </div>
          </div>
        </Panel>

        <div className="space-y-5">
          <section className="glass rise p-5">
            <div className="flex items-center gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/25">
                <TelegramIcon className="size-6" />
              </div>
              <div className="min-w-0 leading-tight">
                <div className="font-display text-[15px] font-semibold">@{TELEGRAM_HANDLE}</div>
                <div className="label-mono">Telegram support</div>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <a
                href={TELEGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={`${primaryBtn} block text-center`}
              >
                Open Telegram chat
              </a>
              <button
                onClick={copyHandle}
                className={`${softBtn} flex w-full items-center justify-center gap-1.5`}
              >
                {copiedHandle ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copiedHandle ? "Copied" : `Copy @${TELEGRAM_HANDLE}`}
              </button>
            </div>
          </section>

          <Panel title="Account check" sub="so we can find you fast">
            <dl className="space-y-2.5 p-5 text-[12px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Email</dt>
                <dd className="truncate font-mono">{me?.email ?? "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Role</dt>
                <dd className="font-mono">{me?.role ?? "—"}</dd>
              </div>
              {me?.role === "reseller" && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Balance</dt>
                  <dd className="font-mono">{me.credits} credits</dd>
                </div>
              )}
            </dl>
          </Panel>

          <div className="glass rise p-5 text-[12px] text-muted-foreground">
            Send the username or the line name with your message — it makes the fix much faster.
          </div>
        </div>
      </div>
    </>
  );
}
