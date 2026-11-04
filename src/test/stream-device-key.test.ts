import { describe, expect, it, vi } from "vitest";

const rpc = vi.fn(async (_n: string, _a: { _client_key: string }) => ({ data: true, error: null }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc } }));

describe("stream device counting", () => {
  it("counts one device per IP even when player user-agents differ", async () => {
    const { checkStreamLimit } = await import("@/lib/stream-proxy.server");
    const req = (ua: string, ip: string) => new Request("https://x.test/", { headers: { "user-agent": ua, "cf-connecting-ip": ip } });
    const line = { username: "u1", maxConnections: 1, lineId: "L" };
    await checkStreamLimit(req("TiviMate", "1.1.1.1"), line);
    await checkStreamLimit(req("ExoPlayer", "1.1.1.1"), line);
    await checkStreamLimit(req("VLC", "2.2.2.2"), line);
    const keys = rpc.mock.calls.map((c) => c[1]._client_key);
    expect(keys.length).toBeGreaterThanOrEqual(2);
    expect(new Set(keys).size).toBe(2);
  });
});
