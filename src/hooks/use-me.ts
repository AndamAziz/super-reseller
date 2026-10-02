import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Me = {
  id: string;
  email: string;
  displayName: string | null;
  credits: number;
  role: "admin" | "reseller" | null;
};

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async (): Promise<Me | null> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", u.user.id),
      ]);
      const r = roles?.map((x) => x.role) ?? [];
      return {
        id: u.user.id,
        email: u.user.email ?? "",
        displayName: profile?.display_name ?? null,
        credits: profile?.credits ?? 0,
        role: r.includes("admin") ? "admin" : r.includes("reseller") ? "reseller" : null,
      };
    },
  });
}

export const isActive = (expiresAt: string) => new Date(expiresAt).getTime() > Date.now();
export const fmtDate = (d: string) => new Date(d).toISOString().slice(0, 10);
export const errMsg = (e: unknown) => (e instanceof Error ? e.message : String((e as any)?.message ?? e));
