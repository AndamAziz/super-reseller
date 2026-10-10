// AI duration recommendation for resellers (Lovable AI Gateway, Responses API, streamed).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({ needs: z.string().trim().min(3).max(1000) });

export const recommendDuration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => input.parse(d))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured");
    const { data: prof } = await context.supabase.from("profiles").select("credits").eq("id", context.userId).maybeSingle();
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    const credits = isAdmin ? 24 : (prof?.credits ?? 0);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key, Authorization: `Bearer ${key}`, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        instructions:
          "You help an IPTV reseller pick a subscription duration for a customer. Options: 0 = free 24-hour test (only if the customer hasn't tried the service), or 1, 3, 6 or 12 months. 1 credit = 1 month. Never recommend more months than the available credits; if credits are 0, recommend 0 (test) or explain they must top up. Give a brief explanation (max 2 sentences) in the same language the reseller wrote in.",
        input: `Customer needs: ${data.needs}\nAvailable credits: ${credits}`,
        text: {
          format: {
            type: "json_schema",
            name: "recommendation",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: { months: { type: "integer" }, explanation: { type: "string" } },
              required: ["months", "explanation"],
            },
          },
        },
      }),
    });
    if (!res.ok || !res.body) {
      const t = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("AI is busy — try again in a moment");
      if (res.status === 402) throw new Error("AI credits are used up — add credits to the workspace");
      throw new Error(`AI request failed (${res.status}) ${t.slice(0, 200)}`);
    }
    // Consume SSE stream, collect output text.
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "", text = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const ev = JSON.parse(payload);
          if (ev.type === "response.output_text.delta") text += ev.delta;
          if (ev.type === "error" || ev.type === "response.failed") throw new Error(ev.error?.message ?? "AI failed");
        } catch (e) {
          if (e instanceof Error && e.message !== "Unexpected end of JSON input" && !(e instanceof SyntaxError)) throw e;
        }
      }
    }
    let out: { months: number; explanation: string };
    try { out = JSON.parse(text); } catch { throw new Error("AI returned an unreadable answer — try again"); }
    const allowed = [0, 1, 3, 6, 12].filter((m) => m <= credits);
    const months = allowed.includes(out.months) ? out.months : allowed.filter((m) => m <= out.months).pop() ?? 0;
    return { months, explanation: String(out.explanation ?? ""), credits };
  });
