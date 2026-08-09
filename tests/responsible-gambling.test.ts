import { describe, expect, it } from "vitest";
import { deviceLabelFrom, isActive, isoInDays, splitLimitChanges } from "@/lib/user-management.server";

describe("responsible gambling limits", () => {
  it("applies tightening immediately", () => {
    const result = splitLimitChanges({ daily_deposit_limit: 500 }, { daily_deposit_limit: 100 });
    expect(result.applied["daily_deposit_limit"]).toBe(100);
    expect(result.rejected).toHaveLength(0);
  });

  it("refuses loosening and removal self-service", () => {
    expect(splitLimitChanges({ daily_deposit_limit: 100 }, { daily_deposit_limit: 900 }).rejected).toContain(
      "daily_deposit_limit",
    );
    expect(splitLimitChanges({ daily_deposit_limit: 100 }, { daily_deposit_limit: null }).rejected).toContain(
      "daily_deposit_limit",
    );
  });

  it("treats setting a first-ever limit as tightening", () => {
    const result = splitLimitChanges({ daily_loss_limit: null }, { daily_loss_limit: 50 });
    expect(result.applied["daily_loss_limit"]).toBe(50);
  });

  it("cooling-off windows read as active until they expire", () => {
    expect(isActive(isoInDays(1))).toBe(true);
    expect(isActive(isoInDays(-1))).toBe(false);
    expect(isActive(null)).toBe(false);
  });

  it("labels devices without leaking the raw user agent", () => {
    expect(deviceLabelFrom(null)).toBeTruthy();
    expect(deviceLabelFrom("Mozilla/5.0 (iPhone)")).toBeTruthy();
  });
});
