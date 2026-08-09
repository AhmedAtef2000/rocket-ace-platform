import { describe, expect, it } from "vitest";
import { floorMultiplier, formatMultiplier, msToReach, multiplierAt } from "@/lib/game-math";

const GROWTH = 0.00006;

describe("crash curve", () => {
  it("starts at 1.00x and grows monotonically", () => {
    expect(multiplierAt(0, GROWTH)).toBe(1);
    expect(multiplierAt(-10, GROWTH)).toBe(1);
    expect(multiplierAt(2000, GROWTH)).toBeGreaterThan(multiplierAt(1000, GROWTH));
  });

  it("msToReach is the inverse of multiplierAt", () => {
    const target = 3.5;
    const ms = msToReach(target, GROWTH);
    expect(multiplierAt(ms, GROWTH)).toBeCloseTo(target, 6);
  });

  it("floors rather than rounds so a payout never overpays", () => {
    expect(floorMultiplier(2.999)).toBe(2.99);
    expect(formatMultiplier(2.999)).toBe("2.99x");
  });
});
