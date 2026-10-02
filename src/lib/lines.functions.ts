// Server functions that keep lines in sync with an Xtream Codes panel.
// Called from the Lines page instead of talking to the DB directly, so the
// panel API and the credit-deducting DB functions stay in one place.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createPanelLine, deletePanelLine, getPanelConfig, setPanelExpiry } from "./xtream.server";

const lineSchema = z.object({
  username: z.string().trim().min(3).max(50).regex(/^[\w.-]+$/),
  password: z.string().min(4).max(100),
  months: z.number().int().min(1).max(24),
});

const renewSchema = z.object({
  lineId: z.string().uuid(),
  months: z.number().int().min(1).max(24),
});

const deleteSchema = z.object({
  lineId: z.string().uuid(),
  username: z.string(),
});

function monthsToUnix(months: number): number {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() + months);
  return Math.floor(d.getTime() / 1000);
}

async function recordPanelStatus(lineId: string, status: string, message: string | null) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("lines").update({ panel_status: status, panel_message: message }).eq("id", lineId);
  } catch {
    // status recording is best-effort; the line itself already exists
  }
}

export const createLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => lineSchema.parse(data))
  .handler(async ({ data, context }) => {
    const panel = getPanelConfig();
    let panelStatus = "local";
    let panelMessage: string | null = "panel not configured";
    if (panel) {
      const res = await createPanelLine(data.username, data.password, monthsToUnix(data.months));
      if (res.ok) {
        panelStatus = "synced";
        panelMessage = null;
      } else {
        panelStatus = "error";
        panelMessage = res.error ?? "panel error";
      }
    }

    const { data: line, error } = await context.supabase.rpc("create_line", {
      _username: data.username,
      _password: data.password,
      _months: data.months,
    });
    if (error) {
      // Roll the panel line back so credits and panel never disagree.
      if (panelStatus === "synced") await deletePanelLine(data.username);
      throw new Error(error.message.includes("duplicate") ? "Username already taken" : error.message);
    }
    if (line) await recordPanelStatus(line.id, panelStatus, panelMessage);
    return { ok: true as const, panelStatus, panelMessage };
  });

export const renewLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => renewSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: line, error } = await context.supabase.rpc("renew_line", {
      _line_id: data.lineId,
      _months: data.months,
    });
    if (error) throw new Error(error.message);

    // Best-effort: mirror the new expiry onto the panel.
    const cfg = getPanelConfig();
    if (cfg && line) {
      const expUnix = Math.floor(new Date(line.expires_at).getTime() / 1000);
      const res = await setPanelExpiry(line.username, expUnix);
      await recordPanelStatus(line.id, res.ok ? "synced" : "error", res.ok ? null : (res.error ?? "panel error"));
    }
    return { ok: true as const };
  });

export const deleteLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => deleteSchema.parse(data))
  .handler(async ({ data, context }) => {
    // Remove from the panel first (best-effort), then the DB row via RLS.
    const cfg = getPanelConfig();
    if (cfg) await deletePanelLine(data.username);
    const { error } = await context.supabase.from("lines").delete().eq("id", data.lineId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
