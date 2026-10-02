import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useLines() {
  return useQuery({
    queryKey: ["lines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lines")
        .select("*, profiles(display_name, email)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
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
