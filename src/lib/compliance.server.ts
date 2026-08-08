// Phase 11 — compliance: jurisdiction eligibility, age gating and KYC cases.
// Real-money features stay locked until every gate below passes; demo play is
// unaffected so the product remains testable without personal data.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Admin = SupabaseClient<Database>;
type KycStatus = Database["public"]["Enums"]["kyc_status"];
type JurisdictionStatus = Database["public"]["Enums"]["jurisdiction_status"];

export const KYC_PROVIDER = "DEMO_MANUAL";

export type ComplianceGate = {
  key: string;
  label: string;
  passed: boolean;
  detail: string;
};

export function ageOn(dateOfBirth: string, at = new Date()): number {
  const dob = new Date(dateOfBirth);
  let age = at.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthday =
    at.getUTCMonth() < dob.getUTCMonth() ||
    (at.getUTCMonth() === dob.getUTCMonth() && at.getUTCDate() < dob.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export function parseKycInput(data: unknown): { sourceOfFunds: string; declaredPep: boolean } {
  const d = (data ?? {}) as { sourceOfFunds?: unknown; declaredPep?: unknown };
  const sourceOfFunds = typeof d.sourceOfFunds === "string" ? d.sourceOfFunds.trim() : "";
  const allowed = ["EMPLOYMENT", "BUSINESS", "INVESTMENTS", "SAVINGS", "OTHER"];
  if (!allowed.includes(sourceOfFunds)) throw new Error("Select a valid source of funds.");
  return { sourceOfFunds, declaredPep: Boolean(d.declaredPep) };
}

export type ComplianceSnapshot = {
  countryCode: string | null;
  dateOfBirth: string | null;
  jurisdiction: {
    country_code: string;
    name: string;
    status: JurisdictionStatus;
    min_age: number;
    notes: string | null;
  } | null;
  kyc: {
    id: string;
    status: KycStatus;
    risk_level: Database["public"]["Enums"]["risk_status"];
    submitted_at: string | null;
    reviewed_at: string | null;
    rejection_reason: string | null;
  } | null;
  gates: ComplianceGate[];
  realMoneyEligible: boolean;
};

export async function complianceSnapshot(
  admin: Admin,
  userId: string,
): Promise<ComplianceSnapshot> {
  const { data: user, error } = await admin
    .from("users")
    .select("country_code, date_of_birth, email_verified_at, status")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);

  const countryCode = user?.country_code ?? null;
  const dateOfBirth = user?.date_of_birth ?? null;

  const [{ data: jurisdiction }, { data: kyc }] = await Promise.all([
    countryCode
      ? admin
          .from("jurisdictions")
          .select("country_code, name, status, min_age, notes")
          .eq("country_code", countryCode)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    admin
      .from("kyc_cases")
      .select("id, status, risk_level, submitted_at, reviewed_at, rejection_reason")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const minAge = jurisdiction?.min_age ?? 18;
  const age = dateOfBirth ? ageOn(dateOfBirth) : null;

  const gates: ComplianceGate[] = [
    {
      key: "identity",
      label: "Country and date of birth on file",
      passed: Boolean(countryCode && dateOfBirth),
      detail: countryCode && dateOfBirth ? `${countryCode} · ${dateOfBirth}` : "Complete your profile first.",
    },
    {
      key: "jurisdiction",
      label: "Jurisdiction permitted",
      passed: jurisdiction?.status === "ALLOWED",
      detail: jurisdiction
        ? `${jurisdiction.name} — ${jurisdiction.status.toLowerCase()}${jurisdiction.notes ? ` (${jurisdiction.notes})` : ""}`
        : "Unknown or unlisted country.",
    },
    {
      key: "age",
      label: `Minimum age (${minAge}+)`,
      passed: age !== null && age >= minAge,
      detail: age === null ? "Date of birth required." : `Age ${age}.`,
    },
    {
      key: "account",
      label: "Account in good standing",
      passed: user?.status === "ACTIVE",
      detail: `Status ${(user?.status ?? "UNKNOWN").toLowerCase()}.`,
    },
    {
      key: "kyc",
      label: "Identity verification approved",
      passed: kyc?.status === "APPROVED",
      detail: kyc ? `Case ${kyc.status.toLowerCase().replace(/_/g, " ")}.` : "Not submitted yet.",
    },
  ];

  return {
    countryCode,
    dateOfBirth,
    jurisdiction: jurisdiction ?? null,
    kyc: kyc ?? null,
    gates,
    realMoneyEligible: gates.every((g) => g.passed),
  };
}

/** Decision for a demo submission — a real provider webhook replaces this. */
export function decideCase(
  snapshot: ComplianceSnapshot,
  input: { declaredPep: boolean },
): { status: KycStatus; risk: Database["public"]["Enums"]["risk_status"]; reason: string | null } {
  const jurisdiction = snapshot.jurisdiction;
  if (!jurisdiction || jurisdiction.status === "BLOCKED") {
    return { status: "REJECTED", risk: "HIGH", reason: "Jurisdiction not permitted." };
  }
  const ageGate = snapshot.gates.find((g) => g.key === "age");
  if (!ageGate?.passed) {
    return { status: "REJECTED", risk: "HIGH", reason: "Below the minimum legal age." };
  }
  if (jurisdiction.status === "REVIEW" || input.declaredPep) {
    return {
      status: "REQUIRES_INFORMATION",
      risk: "REVIEW_REQUIRED",
      reason: input.declaredPep
        ? "Politically exposed person — enhanced due diligence required."
        : "Jurisdiction requires manual review.",
    };
  }
  return { status: "APPROVED", risk: "LOW", reason: null };
}

/** Gate used by real-money surfaces (deposits, withdrawals). */
export async function assertRealMoneyEligible(admin: Admin, userId: string): Promise<void> {
  const snapshot = await complianceSnapshot(admin, userId);
  if (!snapshot.realMoneyEligible) {
    const failed = snapshot.gates.find((g) => !g.passed);
    throw new Error(failed ? `Compliance check failed: ${failed.label}.` : "Compliance check failed.");
  }
}