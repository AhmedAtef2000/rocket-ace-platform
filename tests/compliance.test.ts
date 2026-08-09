import { describe, expect, it } from "vitest";
import { ageOn, decideCase, parseKycInput } from "@/lib/compliance.server";
import type { ComplianceSnapshot } from "@/lib/compliance.server";

function snapshot(over: Partial<ComplianceSnapshot> = {}): ComplianceSnapshot {
  return {
    jurisdiction: { code: "GB", status: "ALLOWED", minimum_age: 18 },
    gates: [
      { key: "age", label: "Legal age", passed: true },
      { key: "kyc", label: "Identity verified", passed: true },
    ],
    realMoneyEligible: true,
    ...(over as object),
  } as ComplianceSnapshot;
}

describe("KYC decisioning", () => {
  it("approves a clean applicant in an allowed jurisdiction", () => {
    expect(decideCase(snapshot(), { declaredPep: false }).status).toBe("APPROVED");
  });

  it("rejects blocked jurisdictions", () => {
    const blocked = snapshot({
      jurisdiction: { code: "XX", status: "BLOCKED", minimum_age: 18 },
    } as Partial<ComplianceSnapshot>);
    expect(decideCase(blocked, { declaredPep: false }).status).toBe("REJECTED");
  });

  it("rejects under-age applicants", () => {
    const underAge = snapshot({
      gates: [{ key: "age", label: "Legal age", passed: false }],
    } as Partial<ComplianceSnapshot>);
    expect(decideCase(underAge, { declaredPep: false }).status).toBe("REJECTED");
  });

  it("escalates politically exposed persons to enhanced due diligence", () => {
    const decision = decideCase(snapshot(), { declaredPep: true });
    expect(decision.status).toBe("REQUIRES_INFORMATION");
    expect(decision.risk).toBe("REVIEW_REQUIRED");
  });

  it("computes age on a fixed date", () => {
    expect(ageOn("2000-01-02", new Date("2020-01-01T00:00:00Z"))).toBe(19);
    expect(ageOn("2000-01-01", new Date("2020-01-01T00:00:00Z"))).toBe(20);
  });

  it("validates KYC submissions", () => {
    expect(() => parseKycInput({ sourceOfFunds: "", declaredPep: false })).toThrow();
    expect(parseKycInput({ sourceOfFunds: "Salary", declaredPep: true }).declaredPep).toBe(true);
  });
});
