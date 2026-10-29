import { describe, expect, it } from "vitest";
import { hasLowCredits, LOW_CREDIT_THRESHOLD } from "../lib/credit-alert";

describe("reseller low-credit warning", () => {
  it("warns below the requested 10-credit threshold", () => {
    expect(LOW_CREDIT_THRESHOLD).toBe(10);
    expect(hasLowCredits("reseller", 9)).toBe(true);
    expect(hasLowCredits("reseller", 0)).toBe(true);
  });
  it("does not warn at or above 10 credits", () => {
    expect(hasLowCredits("reseller", 10)).toBe(false);
    expect(hasLowCredits("reseller", 11)).toBe(false);
  });
  it("does not warn admins or accounts without a reseller role", () => {
    expect(hasLowCredits("admin", 0)).toBe(false);
    expect(hasLowCredits(null, 0)).toBe(false);
  });
});