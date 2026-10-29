export const LOW_CREDIT_THRESHOLD = 10;

export function hasLowCredits(role: "admin" | "reseller" | null | undefined, credits: number): boolean {
  return role === "reseller" && credits < LOW_CREDIT_THRESHOLD;
}