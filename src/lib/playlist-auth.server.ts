// Shared auth + source loading for the public playlist endpoints (M3U and Xtream-compatible).
import { parseM3U, type M3UChannel } from "./m3u";

export type AuthResult =
  | { ok: true; username: string; password: string; expiresAt: string; createdAt: string | null }
  | { ok: false; status: number; message: string };

export async function authLine(username: string, password: string): Promise<AuthResult> {
  if (!username || !password || username.length > 50 || password.length > 100) {
    return { ok: false, status: 401, message: "Invalid credentials" };
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: line } = await supabaseAdmin
    .from("lines")
    .select("username, password, expires_at, created_at")
    .eq("username", username.trim())
    .maybeSingle();
  if (!line || line.password !== password) return { ok: false, status: 401, message: "Invalid credentials" };
  if (new Date(line.expires_at).getTime() <= Date.now()) return { ok: false, status: 403, message: "Subscription expired" };
  return { ok: true, username: line.username, password: line.password, expiresAt: line.expires_at, createdAt: line.created_at ?? null };
}

export async function loadSourceText(): Promise<{ ok: true; text: string } | { ok: false; status: number; message: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("app_settings").select("value").eq("key", "m3u_source_url").maybeSingle();
  if (!data?.value) return { ok: false, status: 503, message: "Playlist not configured" };
  try {
    const res = await fetch(data.value, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return { ok: false, status: 502, message: `Playlist source unavailable (HTTP ${res.status})` };
    return { ok: true, text: await res.text() };
  } catch {
    return { ok: false, status: 502, message: "Playlist source unreachable" };
  }
}

export async function loadChannels(): Promise<{ ok: true; channels: M3UChannel[] } | { ok: false; status: number; message: string }> {
  const src = await loadSourceText();
  if (!src.ok) return src;
  return { ok: true, channels: parseM3U(src.text) };
}

export const plain = (body: string, status: number) =>
  new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" },
  });
