import { describe, expect, it } from "vitest";
import { connectionUpgradeCost, renewalCost } from "../lib/connection-pricing";

describe("reseller connection pricing", () => {
  const at = new Date("2026-10-29T05:09:00Z");
  it("charges one credit per extra connection per remaining subscription month", () => {
    expect(connectionUpgradeCost("2027-01-29T05:09:00Z", 1, 3, at)).toBe(6);
  });
  it("rounds a partial remaining month up", () => {
    expect(connectionUpgradeCost("2026-11-30T05:09:00Z", 1, 2, at)).toBe(2);
  });
  it("does not refund reductions", () => {
    expect(connectionUpgradeCost("2027-01-29T05:09:00Z", 3, 1, at)).toBe(0);
  });
  it("charges no remaining-duration upgrade fee on expired lines", () => {
    expect(connectionUpgradeCost("2026-10-28T05:09:00Z", 1, 5, at)).toBe(0);
  });
  it("charges all connections for renewal", () => {
    expect(renewalCost(3, 5)).toBe(15);
  });
  it("charges five additional credits when a one-month line goes from one to six devices", () => {
    expect(connectionUpgradeCost("2026-11-28T02:13:41Z", 1, 6, new Date("2026-10-29T05:21:00Z"))).toBe(5);
    expect(renewalCost(1, 6)).toBe(6);
  });
  it("handles end-of-month UTC dates the same as the database", () => {
    expect(connectionUpgradeCost("2027-02-28T05:09:00Z", 1, 2, new Date("2027-01-31T05:09:00Z"))).toBe(1);
  });
});