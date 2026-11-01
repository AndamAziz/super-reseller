import type { ReactNode } from "react";
import { useMe } from "@/hooks/use-me";

/** Renders children only for admins; resellers never mount the admin page. */
export function AdminOnly({ children }: { children: ReactNode }) {
  const { data: me, isLoading } = useMe();
  if (isLoading || !me) return null;
  if (me.role !== "admin") return <p className="text-muted-foreground">Admins only.</p>;
  return <>{children}</>;
}
