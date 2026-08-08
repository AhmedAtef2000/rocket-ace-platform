// Phase 13 — risk & fraud engine.
// Pure scoring rules over data the platform already records. Every signal is
// derived server-side; nothing here trusts client input.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Admin = SupabaseClient<Database>;
type Severity = Database["public"]["Enums"]["risk_status"];

export type RiskSignal = {
  key: string;
  label: string;
  score: number;
  detail: string;
};

export type RiskProfile = {
  userId: string;
  score: number;
  severity: Severity;
  signals: RiskSignal[];
  computedAt: string;
};

const DAY = 86_400_000;

function num(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === "number" ? value : Number(value);
}

export function severityFor(score: number): Severity {
  if (score >= 80) return "REVIEW_REQUIRED";
  if (score >= 55) return "HIGH";
  if (score >= 30) return "MEDIUM";
  return "LOW";
}

/**
 * Builds a risk profile from deposit/withdrawal velocity, betting behaviour,
 * KYC posture and device sharing. Read-only: callers decide what to persist.
 */
export async function buildRiskProfile(admin: Admin, userId: string): Promise<RiskProfile> {
  const since24h = new Date(Date.now() - DAY).toISOString();
  const since7d = new Date(Date.now() - 7 * DAY).toISOString();

  const [user, kyc, deposits, withdrawals, bets, sessions] = await Promise.all([
    admin
      .from("users")
      .select("id, status, country_code, created_at, mfa_enabled, email_verified_at")
      .eq("id", userId)
      .maybeSingle(),
    admin
      .from("kyc_cases")
      .select("status, risk_level")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("deposits")
      .select("confirmed_amount, currency, status, created_at")
      .eq("user_id", userId)
      .gte("created_at", since24h),
    admin
      .from("withdrawals")
      .select("amount, currency, status, requested_at")
      .eq("user_id", userId)
      .gte("requested_at", since7d),
    admin
      .from("bets")
      .select("amount, status, payout_amount, kind, placed_at")
      .eq("user_id", userId)
      .gte("placed_at", since24h),
    admin
      .from("user_sessions")
      .select("ip_address")
      .eq("user_id", userId)
      .is("revoked_at", null)
      .limit(25),
  ]);

  const signals: RiskSignal[] = [];

  const depositCount = (deposits.data ?? []).length;
  const depositValue = (deposits.data ?? []).reduce((s, d) => s + num(d.confirmed_amount), 0);
  if (depositCount >= 5) {
    signals.push({
      key: "deposit.velocity",
      label: "Deposit velocity",
      score: Math.min(30, depositCount * 4),
      detail: `${depositCount} deposits in the last 24 hours.`,
    });
  }

  const withdrawalValue = (withdrawals.data ?? [])
    .filter((w) => !["REJECTED", "CANCELLED", "FAILED"].includes(w.status))
    .reduce((s, w) => s + num(w.amount), 0);
  if (depositValue > 0 && withdrawalValue > depositValue * 0.9 && withdrawalValue > 0) {
    signals.push({
      key: "payout.passthrough",
      label: "Deposit pass-through",
      score: 35,
      detail: "Withdrawals closely match recent deposits with little play in between.",
    });
  }
  const largeWithdrawals = (withdrawals.data ?? []).filter((w) => num(w.amount) >= 1000).length;
  if (largeWithdrawals > 0) {
    signals.push({
      key: "payout.large",
      label: "Large payout",
      score: 20 + Math.min(20, largeWithdrawals * 10),
      detail: `${largeWithdrawals} withdrawal(s) at or above the dual-approval threshold.`,
    });
  }

  const realBets = (bets.data ?? []).filter((b) => b.kind === "REAL");
  const wagered = realBets.reduce((s, b) => s + num(b.amount), 0);
  const returned = realBets.reduce((s, b) => s + num(b.payout_amount), 0);
  if (realBets.length >= 50) {
    signals.push({
      key: "bet.velocity",
      label: "Betting velocity",
      score: Math.min(20, Math.floor(realBets.length / 10)),
      detail: `${realBets.length} real-money bets in 24 hours.`,
    });
  }
  if (wagered > 0 && returned > wagered * 2 && realBets.length >= 10) {
    signals.push({
      key: "bet.anomaly",
      label: "Return anomaly",
      score: 25,
      detail: "Returns are far above expectation for the volume played.",
    });
  }

  const kycStatus = kyc.data?.status ?? "NOT_STARTED";
  if (kycStatus !== "APPROVED" && (depositValue > 0 || withdrawalValue > 0)) {
    signals.push({
      key: "kyc.unverified",
      label: "Unverified funding",
      score: 40,
      detail: `Real-money activity while KYC is ${kycStatus.toLowerCase().replace(/_/g, " ")}.`,
    });
  }
  if (kyc.data?.risk_level === "HIGH" || kyc.data?.risk_level === "REVIEW_REQUIRED") {
    signals.push({
      key: "kyc.risk",
      label: "Elevated KYC risk",
      score: 20,
      detail: "The KYC decision flagged this customer as elevated risk.",
    });
  }

  const ips = Array.from(
    new Set((sessions.data ?? []).map((s) => s.ip_address).filter(Boolean) as string[]),
  );
  if (ips.length > 0) {
    const { data: shared } = await admin
      .from("user_sessions")
      .select("user_id, ip_address")
      .in("ip_address", ips)
      .neq("user_id", userId)
      .limit(50);
    const others = new Set((shared ?? []).map((s) => s.user_id));
    if (others.size >= 2) {
      signals.push({
        key: "device.sharing",
        label: "Shared network",
        score: Math.min(30, 10 * others.size),
        detail: `${others.size} other accounts seen on the same IP address.`,
      });
    }
  }

  const accountAgeHours = user.data?.created_at
    ? (Date.now() - new Date(user.data.created_at).getTime()) / 3_600_000
    : 0;
  if (accountAgeHours < 24 && withdrawalValue > 0) {
    signals.push({
      key: "account.new",
      label: "New account payout",
      score: 25,
      detail: "Withdrawal requested within 24 hours of registration.",
    });
  }
  if (user.data && !user.data.mfa_enabled && withdrawalValue >= 1000) {
    signals.push({
      key: "account.nomfa",
      label: "No two-factor",
      score: 15,
      detail: "Large payout on an account without two-factor authentication.",
    });
  }

  const score = Math.min(100, signals.reduce((s, x) => s + x.score, 0));
  return {
    userId,
    score,
    severity: severityFor(score),
    signals,
    computedAt: new Date().toISOString(),
  };
}

/** Persists a risk event, de-duplicated within a 6 hour window per user. */
export async function recordRiskProfile(
  admin: Admin,
  profile: RiskProfile,
  source: string,
): Promise<{ created: boolean }> {
  if (profile.score < 30) return { created: false };
  const since = new Date(Date.now() - 6 * 3_600_000).toISOString();
  const { data: existing } = await admin
    .from("risk_events")
    .select("id")
    .eq("user_id", profile.userId)
    .eq("event_type", "risk.profile")
    .eq("source", source)
    .gte("created_at", since)
    .limit(1);
  if (existing && existing.length > 0) return { created: false };

  const { error } = await admin.from("risk_events").insert({
    user_id: profile.userId,
    event_type: "risk.profile",
    risk_score: profile.score,
    severity: profile.severity,
    status: "OPEN",
    source,
    description: profile.signals.map((s) => s.label).join(", ") || "Automated risk scan",
    metadata: { signals: profile.signals } as never,
  });
  if (error) throw new Error(error.message);
  return { created: true };
}