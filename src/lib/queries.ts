import { useQuery } from "@tanstack/react-query";
import { deviceLabel } from "@/lib/device";
import { supabase } from "@/integrations/supabase/client";

export type LineDevice = { label: string; ip: string | null; lastSeen: string };

export function useLines() {
  return useQuery({
    queryKey: ["lines"],
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lines")
        .select("*, profiles(display_name, email)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const since = new Date(Date.now() - 90_000).toISOString();
      const { data: conns } = await supabase
        .from("active_connections")
        .select("line_id, user_agent, ip, last_seen")
        .gte("last_seen", since);
      const counts = new Map<string, number>();
      const devices = new Map<string, LineDevice[]>();
      for (const c of conns ?? []) {
        counts.set(c.line_id, (counts.get(c.line_id) ?? 0) + 1);
        const list = devices.get(c.line_id) ?? [];
        list.push({ label: deviceLabel(c.user_agent, c.ip), ip: c.ip ?? null, lastSeen: c.last_seen });
        devices.set(c.line_id, list);
      }
      return data.map((l) => ({
        ...l,
        active_connections: counts.get(l.id) ?? 0,
        active_devices: devices.get(l.id) ?? [] as LineDevice[],
      }));
    },
  });
}

export function useResellers() {
  return useQuery({
    queryKey: ["resellers"],
    queryFn: async () => {
      const { data: roles, error: rErr } = await supabase.from("user_roles").select("user_id").eq("role", "reseller");
      if (rErr) throw rErr;
      const ids = roles.map((r) => r.user_id);
      if (!ids.length) return [];
      const { data, error } = await supabase.from("profiles").select("*").in("id", ids).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useTransactions() {
  return useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_transactions")
        .select("*, profiles(display_name, email)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });
}

export function usePlaylists() {
  return useQuery({
    queryKey: ["playlists"],
    queryFn: async () => {
      const { data, error } = await supabase.from("playlists").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
