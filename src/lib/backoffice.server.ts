// Section 8 — back-office helpers (server only).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Admin = SupabaseClient<Database>;

export const USER_STATUSES = [
  "PENDING_VERIFICATION",
  "ACTIVE",
  "RESTRICTED",
  "SUSPENDED",
  "SELF_EXCLUDED",
  "CLOSED",
] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

function str(value: unknown, max = 200): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export function parseSettingsInput(raw: unknown) {
  const d = (raw ?? {}) as Record<string, unknown>;
  const siteName = str(d["siteName"], 60);
  if (!siteName) throw new Error("Site name is required.");
  const supportEmail = str(d["supportEmail"], 120) ?? "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(supportEmail)) {
    throw new Error("Enter a valid support email address.");
  }
  return {
    site_name: siteName,
    tagline: str(d["tagline"], 160) ?? "",
    logo_url: str(d["logoUrl"], 500),
    support_email: supportEmail,
    house_edge_note: str(d["houseEdgeNote"], 500) ?? "",
    maintenance_mode: d["maintenanceMode"] === true,
  };
}

export function parseUserSearch(raw: unknown): string {
  const d = (raw ?? {}) as Record<string, unknown>;
  const q = str(d["query"], 120);
  if (!q || q.length < 2) throw new Error("Enter at least 2 characters to search.");
  return q;
}

export function parseStatusInput(raw: unknown): {
  userId: string;
  status: UserStatus;
  note: string | null;
} {
  const d = (raw ?? {}) as Record<string, unknown>;
  const userId = str(d["userId"], 60);
  const status = str(d["status"], 40);
  if (!userId) throw new Error("Missing user.");
  if (!status || !USER_STATUSES.includes(status as UserStatus)) throw new Error("Invalid status.");
  return { userId, status: status as UserStatus, note: str(d["note"], 400) };
}

export function parseAdminProfileInput(raw: unknown) {
  const d = (raw ?? {}) as Record<string, unknown>;
  const userId = str(d["userId"], 60);
  if (!userId) throw new Error("Missing user.");
  const dob = str(d["dateOfBirth"], 10);
  if (dob && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) throw new Error("Date of birth must be YYYY-MM-DD.");
  const country = str(d["countryCode"], 2);
  return {
    userId,
    profile: {
      first_name: str(d["firstName"], 80),
      last_name: str(d["lastName"], 80),
      phone: str(d["phone"], 40),
      address_line_1: str(d["addressLine1"], 160),
      city: str(d["city"], 80),
      postal_code: str(d["postalCode"], 20),
    },
    dateOfBirth: dob,
    countryCode: country ? country.toUpperCase() : null,
  };
}

export function parseManualDecision(raw: unknown): {
  id: string;
  decision: "APPROVED" | "REJECTED";
  note: string | null;
} {
  const d = (raw ?? {}) as Record<string, unknown>;
  const id = str(d["id"], 60);
  const decision = str(d["decision"], 20);
  if (!id) throw new Error("Missing request.");
  if (decision !== "APPROVED" && decision !== "REJECTED") throw new Error("Invalid decision.");
  return { id, decision, note: str(d["note"], 400) };
}

/** Signed, short-lived URL for a private storage object (proofs, KYC docs). */
export async function signedUrl(
  admin: Admin,
  bucket: string,
  path: string | null,
  seconds = 300,
): Promise<string | null> {
  if (!path) return null;
  const { data } = await admin.storage.from(bucket).createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}
