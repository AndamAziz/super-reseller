// Server-only helper that talks to an Xtream Codes / XUI panel via panel_api.php.
// All config comes from env secrets: XTREAM_PANEL_URL, XTREAM_ADMIN_USERNAME, XTREAM_ADMIN_PASSWORD.
// When they are absent the panel is treated as "not configured" and lines stay internal-only.

export interface PanelConfig {
  base: string;
  username: string;
  password: string;
}

export interface PanelResult {
  ok: boolean;
  configured: boolean;
  error?: string;
}

export function getPanelConfig(): PanelConfig | null {
  const base = process.env['XTREAM_PANEL_URL'];
  const username = process.env['XTREAM_ADMIN_USERNAME'];
  const password = process.env['XTREAM_ADMIN_PASSWORD'];
  if (!base || !username || !password) return null;
  return { base: base.replace(/\/+$/, ""), username, password };
}

const PANEL_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Xtream Codes Panel Client)",
  Accept: "application/json, text/plain, */*",
} as const;

/** Try panel_api.php first; on 404 fall back to player_api.php (standard Xtream panels). */
async function panelCall(
  params: Record<string, string>,
): Promise<PanelResult & { data?: unknown; endpoint?: string }> {
  const cfg = getPanelConfig();
  if (!cfg) return { ok: false, configured: false, error: "panel not configured" };

  let lastError = "no answer";
  for (const endpoint of ["panel_api.php", "player_api.php"]) {
    const url = new URL(`${cfg.base}/${endpoint}`);
    url.searchParams.set("username", cfg.username);
    url.searchParams.set("password", cfg.password);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    try {
      const res = await fetch(url, { headers: PANEL_HEADERS, signal: AbortSignal.timeout(15000) });
      if (res.status === 404 && endpoint === "panel_api.php") {
        lastError = "HTTP 404";
        continue; // try player_api.php
      }
      if (!res.ok) return { ok: false, configured: true, error: `HTTP ${res.status}`, endpoint };
      const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return { ok: false, configured: true, error: text.slice(0, 200) };
    }
    const obj = data as { result?: boolean; error?: unknown } | null;
    if (obj && obj.result === false) {
      const msg = typeof obj.error === "string" ? obj.error : "panel rejected the action";
      return { ok: false, configured: true, error: msg };
    }
    return { ok: true, configured: true, data };
  } catch (e) {
    return { ok: false, configured: true, error: e instanceof Error ? e.message : "network error" };
  }
}

/** Create a line on the panel. expDateUnix = expiry as a unix timestamp (seconds). */
export function createPanelLine(lineUser: string, linePass: string, expDateUnix: number, maxConnections = 1) {
  return panelCall({
    action: "create",
    user: lineUser,
    password: linePass,
    exp_date: String(expDateUnix),
    max_connections: String(maxConnections),
    bouquet: "1",
  });
}

/** Push a new expiry (unix seconds) onto an existing panel line. */
export function setPanelExpiry(lineUser: string, expDateUnix: number) {
  return panelCall({ action: "edit", user: lineUser, exp_date: String(expDateUnix) });
}

/** Remove a line from the panel. */
export function deletePanelLine(lineUser: string) {
  return panelCall({ action: "delete", user: lineUser });
}

export interface PanelTestResult {
  ok: boolean;
  configured: boolean;
  url?: string;
  checks: { name: string; ok: boolean; detail: string }[];
}

/**
 * Verify the saved panel settings step by step:
 * 1. secrets present, 2. base URL reachable, 3. panel_api.php answers,
 * 4. admin credentials accepted.
 */
export async function testPanelConnection(): Promise<PanelTestResult> {
  const cfg = getPanelConfig();
  if (!cfg) {
    return {
      ok: false,
      configured: false,
      checks: [{ name: "Settings saved", ok: false, detail: "panel URL, username or password is missing" }],
    };
  }

  const checks: PanelTestResult["checks"] = [{ name: "Settings saved", ok: true, detail: cfg.base }];

  // 2. Base URL reachable
  try {
    const res = await fetch(cfg.base, { signal: AbortSignal.timeout(10000) });
    checks.push({ name: "Panel URL reachable", ok: true, detail: `HTTP ${res.status}` });
  } catch (e) {
    checks.push({
      name: "Panel URL reachable",
      ok: false,
      detail: e instanceof Error ? e.message : "network error",
    });
    return { ok: false, configured: true, url: cfg.base, checks };
  }

  // 3 + 4. panel_api.php answers and accepts the credentials
  const api = await panelCall({ action: "server_info" });
  if (api.ok) {
    checks.push({ name: "API endpoint (panel_api.php)", ok: true, detail: "answered" });
    const info = (api.data as { user_info?: Record<string, unknown> } | null)?.user_info;
    // A normal subscriber line returns exp_date/max_connections — such an account can watch but not create lines.
    if (info && ("exp_date" in info || "max_connections" in info)) {
      checks.push({
        name: "Admin credentials",
        ok: false,
        detail: "these are a customer (subscriber) login, not a panel admin/reseller account — they can't create lines",
      });
    } else {
      checks.push({ name: "Admin credentials", ok: true, detail: "accepted" });
    }
    // 5. Can we actually create lines? The admin API (api.php) must allow our server.
    let adminOk = false;
    let adminDetail = "no answer";
    try {
      const u = new URL(`${cfg.base}/api.php`);
      u.searchParams.set("username", cfg.username);
      u.searchParams.set("password", cfg.password);
      u.searchParams.set("action", "user");
      u.searchParams.set("sub", "info");
      const r = await fetch(u, { signal: AbortSignal.timeout(10000) });
      const t = await r.text();
      if (/IP FORBIDDEN/i.test(t)) adminDetail = "blocked — the panel only accepts admin calls from whitelisted IPs";
      else if (!r.ok) adminDetail = `HTTP ${r.status}`;
      else if (/"result"\s*:\s*false/.test(t)) adminDetail = "rejected by panel";
      else { adminOk = true; adminDetail = "allowed"; }
    } catch (e) {
      adminDetail = e instanceof Error ? e.message : "network error";
    }
    checks.push({ name: "Line creation allowed", ok: adminOk, detail: adminDetail });
    return { ok: checks.every((c) => c.ok), configured: true, url: cfg.base, checks };
  }

  const is404 = api.error === "HTTP 404";
  // Many panels answer 404 on panel_api.php when the login is wrong or blocked — ask player_api.php for the real reason.
  let reason = "";
  if (is404) {
    try {
      const u = new URL(`${cfg.base}/player_api.php`);
      u.searchParams.set("username", cfg.username);
      u.searchParams.set("password", cfg.password);
      const r = await fetch(u, { signal: AbortSignal.timeout(10000) });
      const j = (await r.json().catch(() => null)) as { message?: string; error?: string; user_info?: { auth?: number } } | null;
      if (j?.error === "USER_BAN") reason = "the saved account has been banned by the panel administrator";
      else if (j?.message || j?.error) reason = String(j.message ?? j.error);
      else if (j?.user_info && j.user_info.auth === 0) reason = "username or password is wrong";
    } catch {
      // keep generic message
    }
  }
  checks.push({
    name: "API endpoint (panel_api.php)",
    ok: false,
    detail: is404
      ? reason
        ? `refused — ${reason}`
        : "not found (HTTP 404) — wrong login, or the URL isn't the panel host and port"
      : (api.error ?? "no answer"),
  });
  if (!is404) {
    checks.push({ name: "Admin credentials", ok: false, detail: api.error ?? "rejected" });
  }
  return { ok: false, configured: true, url: cfg.base, checks };
}
