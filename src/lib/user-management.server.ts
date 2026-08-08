// Server-only helpers for Phase 4 user management.
// Kept out of *.functions.ts so server-function splitting cannot strip them.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Admin = SupabaseClient<Database>;

export type ProfileInput = {
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  postal_code: string | null;
  country_code: string | null;
  date_of_birth: string | null;
};

const MAX = 120;

function clean(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX);
}

export function parseProfileInput(raw: unknown): ProfileInput {
  const d = (raw ?? {}) as Record<string, unknown>;
  const country = clean(d["country_code"]);
  const dob = clean(d["date_of_birth"]);
  if (country && !/^[A-Za-z]{2}$/.test(country)) {
    throw new Error("Country must be a 2-letter ISO code.");
  }
  if (dob && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
    throw new Error("Date of birth must be YYYY-MM-DD.");
  }
  if (dob && ageFrom(dob) < 18) {
    throw new Error("You must be at least 18 years old to hold an account.");
  }
  return {
    first_name: clean(d["first_name"]),
    last_name: clean(d["last_name"]),
    phone: clean(d["phone"]),
    address_line_1: clean(d["address_line_1"]),
    address_line_2: clean(d["address_line_2"]),
    city: clean(d["city"]),
    postal_code: clean(d["postal_code"]),
    country_code: country ? country.toUpperCase() : null,
    date_of_birth: dob,
  };
}

export function ageFrom(dob: string): number {
  const birth = new Date(`${dob}T00:00:00Z`);
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age;
}

export const RG_LIMIT_FIELDS = [
  "deposit_daily_limit",
  "deposit_weekly_limit",
  "deposit_monthly_limit",
  "loss_daily_limit",
  "loss_weekly_limit",
  "loss_monthly_limit",
  "session_limit_minutes",
] as const;

export type RgLimitField = (typeof RG_LIMIT_FIELDS)[number];
export type RgLimitInput = Partial<Record<RgLimitField, number | null>>;

export function parseRgInput(raw: unknown): RgLimitInput {
  const d = (raw ?? {}) as Record<string, unknown>;
  const out: RgLimitInput = {};
  for (const field of RG_LIMIT_FIELDS) {
    if (!(field in d)) continue;
    const value = d[field];
    if (value === null || value === "" || value === undefined) {
      out[field] = null;
      continue;
    }
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) {
      throw new Error(`${field.replaceAll("_", " ")} must be a positive number.`);
    }
    out[field] = num;
  }
  return out;
}

/**
 * Regulator-safe limit change rules:
 *  - Tightening (lower value, or setting a value where none existed) applies immediately.
 *  - Loosening (higher value, or removing a limit) is refused self-service.
 */
export function splitLimitChanges(
  current: Record<string, number | null>,
  requested: RgLimitInput,
): { applied: RgLimitInput; rejected: RgLimitField[] } {
  const applied: RgLimitInput = {};
  const rejected: RgLimitField[] = [];
  for (const field of RG_LIMIT_FIELDS) {
    if (!(field in requested)) continue;
    const next = requested[field] ?? null;
    const now = current[field] ?? null;
    if (next === now) continue;
    const looser = next === null || (now !== null && next > now);
    if (looser) rejected.push(field);
    else applied[field] = next;
  }
  return { applied, rejected };
}

export function deviceLabelFrom(userAgent: string | null): string {
  const ua = userAgent ?? "";
  const os = /Windows/i.test(ua)
    ? "Windows"
    : /Mac OS X|Macintosh/i.test(ua)
      ? "macOS"
      : /Android/i.test(ua)
        ? "Android"
        : /iPhone|iPad|iOS/i.test(ua)
          ? "iOS"
          : /Linux/i.test(ua)
            ? "Linux"
            : "Unknown OS";
  const browser = /Edg\//i.test(ua)
    ? "Edge"
    : /OPR\//i.test(ua)
      ? "Opera"
      : /Chrome\//i.test(ua)
        ? "Chrome"
        : /Safari\//i.test(ua)
          ? "Safari"
          : /Firefox\//i.test(ua)
            ? "Firefox"
            : "Unknown browser";
  return `${browser} on ${os}`;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function requireUuid(value: unknown, label: string): string {
  if (typeof value !== "string" || !UUID_RE.test(value)) {
    throw new Error(`Invalid ${label}.`);
  }
  return value.toLowerCase();
}

export async function audit(
  admin: Admin,
  entry: {
    actorId: string;
    action: string;
    resourceType?: string;
    resourceId?: string | null;
    userAgent?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await admin.from("audit_logs").insert({
    actor_id: entry.actorId,
    actor_role: "PLAYER",
    action: entry.action,
    resource_type: entry.resourceType ?? "user",
    resource_id: entry.resourceId ?? entry.actorId,
    user_agent: entry.userAgent ?? null,
    metadata: (entry.metadata ?? {}) as never,
  });
}

export function isoInDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

export function isActive(until: string | null | undefined): boolean {
  return !!until && new Date(until).getTime() > Date.now();
}
