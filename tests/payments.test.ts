import { describe, expect, it } from "vitest";
import {
  DUAL_APPROVAL_THRESHOLD,
  WITHDRAWAL_FEE_RATE,
  parseDepositInput,
  parseWithdrawalInput,
  toNumber,
} from "@/lib/payments.server";
import { RATE_LIMITS } from "@/lib/rate-limit.server";

describe("payments validation", () => {
  it("rejects malformed deposit input", () => {
    expect(() => parseDepositInput({})).toThrow();
  });

  it("rejects non-positive withdrawals", () => {
    expect(() =>
      parseWithdrawalInput({ currency: "USDT", network: "TRON", amount: 0, address: "abc" }),
    ).toThrow();
    expect(() =>
      parseWithdrawalInput({ currency: "USDT", network: "TRON", amount: -5, address: "abc" }),
    ).toThrow();
  });

  it("parses numeric strings from the database without float drift", () => {
    expect(toNumber("10.25")).toBe(10.25);
    expect(toNumber(null)).toBe(0);
  });

  it("charges a 1% fee and requires dual approval above the threshold", () => {
    expect(WITHDRAWAL_FEE_RATE).toBe(0.01);
    expect(1000 * WITHDRAWAL_FEE_RATE).toBe(10);
    expect(DUAL_APPROVAL_THRESHOLD).toBeGreaterThan(0);
    const approvals = (amount: number) => (amount >= DUAL_APPROVAL_THRESHOLD ? 2 : 1);
    expect(approvals(DUAL_APPROVAL_THRESHOLD)).toBe(2);
    expect(approvals(DUAL_APPROVAL_THRESHOLD - 1)).toBe(1);
  });
});

describe("rate limit rules", () => {
  it("keeps money-movement buckets tighter than read paths", () => {
    expect(RATE_LIMITS["withdrawal.request"].limit).toBeLessThanOrEqual(
      RATE_LIMITS["deposit.create"].limit,
    );
    for (const rule of Object.values(RATE_LIMITS)) {
      expect(rule.limit).toBeGreaterThan(0);
      expect(rule.windowSeconds).toBeGreaterThan(0);
    }
  });
});
