/** UTC calendar months, rounded up, matching the database connection quote. */
export function connectionUpgradeCost(expiresAt: string, previous: number, next: number, at = new Date()): number {
  const expiry = new Date(expiresAt);
  if (next <= previous || expiry <= at) return 0;
  let months = 0;
  while (true) {
    const end = new Date(at);
    end.setUTCDate(1);
    end.setUTCMonth(at.getUTCMonth() + months);
    const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
    end.setUTCDate(Math.min(at.getUTCDate(), lastDay));
    if (end >= expiry) break;
    months++;
  }
  return (next - previous) * months;
}

export function renewalCost(months: number, connections: number): number {
  return months * connections;
}