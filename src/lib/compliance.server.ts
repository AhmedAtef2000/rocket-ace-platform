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
  /** Internal gates are enforced but not surfaced to players. */
  internal?: boolean;
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

export const KYC_DOC_TYPES = [
  { value: "ID_FRONT", label: "Government ID — front" },
  { value: "ID_BACK", label: "Government ID — back" },
  { value: "SELFIE", label: "Selfie holding your ID" },
  { value: "PROOF_OF_ADDRESS", label: "Proof of address" },
] as const;

export const KYC_DOC_MAX_BYTES = 10 * 1024 * 1024;
const KYC_DOC_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export type KycDocumentInput = {
  docType: string;
  fileName: string;
  mimeType: string;
  contentBase64: string;
};

export function parseKycDocumentInput(data: unknown): KycDocumentInput {
  const d = (data ?? {}) as Record<string, unknown>;
  const docType = typeof d['docType'] === "string" ? d['docType'] : "";
  if (!KYC_DOC_TYPES.some((t) => t.value === docType)) {
    throw new Error("Select a valid document type.");
  }
  const mimeType = typeof d['mimeType'] === "string" ? d['mimeType'] : "";
  if (!KYC_DOC_MIME.includes(mimeType)) {
    throw new Error("Upload a JPG, PNG, WEBP or PDF file.");
  }
  const fileName = typeof d['fileName'] === "string" ? d['fileName'].slice(0, 120) : "document";
  const contentBase64 = typeof d['contentBase64'] === "string" ? d['contentBase64'] : "";
  if (!contentBase64) throw new Error("The file could not be read. Try again.");
  // base64 expands by ~4/3
  if (contentBase64.length * 0.75 > KYC_DOC_MAX_BYTES) {
    throw new Error("Files must be 10 MB or smaller.");
  }
  return { docType, fileName, mimeType, contentBase64 };
}

export type KycDocument = {
  id: string;
  doc_type: string;
  file_name: string;
  status: string;
  review_note: string | null;
  created_at: string;
};

export type ComplianceSnapshot = {
  countryCode: string | null;
  dateOfBirth: string | null;
  personal: {
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    email: string | null;
    currency: string | null;
  };
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
  documents: KycDocument[];
};

export async function complianceSnapshot(
  admin: Admin,
  userId: string,
): Promise<ComplianceSnapshot> {
  const { data: user, error } = await admin
    .from("users")
    .select("country_code, date_of_birth, email, email_verified_at, status, real_money_enabled")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);

  const countryCode = user?.country_code ?? null;
  const dateOfBirth = user?.date_of_birth ?? null;

  const [{ data: jurisdiction }, { data: kyc }, { data: documents }, { data: profile }, { data: wallets }] =
    await Promise.all([
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
    admin
      .from("kyc_documents")
      .select("id, doc_type, file_name, status, review_note, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("user_profiles")
      .select("first_name, last_name, phone")
      .eq("user_id", userId)
      .maybeSingle(),
    admin
      .from("wallets")
      .select("currency, kind")
      .eq("user_id", userId),
  ]);

  const realWallet = (wallets ?? []).find((w) => w.kind !== "DEMO") ?? (wallets ?? [])[0] ?? null;

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
      internal: true,
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
    {
      key: "real_money_enabled",
      label: "Real-money play enabled",
      passed: user?.real_money_enabled === true,
      detail: user?.real_money_enabled ? "Enabled." : "Real-money play is disabled for your account.",
    },
  ];

  return {
    countryCode,
    dateOfBirth,
    personal: {
      firstName: profile?.first_name ?? null,
      lastName: profile?.last_name ?? null,
      phone: profile?.phone ?? null,
      email: user?.email ?? null,
      currency: realWallet?.currency ?? null,
    },
    jurisdiction: jurisdiction ?? null,
    kyc: kyc ?? null,
    gates,
    realMoneyEligible: gates.every((g) => g.passed),
    documents: (documents ?? []) as KycDocument[],
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