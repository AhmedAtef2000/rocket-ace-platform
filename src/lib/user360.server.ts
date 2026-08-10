// Admin "User 360" data layer. Server only — never imported by client code.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { adminIdentity, num, type AdminIdentity } from "@/lib/admin.server";

type Admin = SupabaseClient<Database>;

export type ListInput = {
  userId: string;
  page: number;
  pageSize: number;
  search: string | null;
  from: string | null;
  to: string | null;
  filter: string | null;
};

/** Requires at least one of the supplied permissions. */
export async function requireAny(
  admin: Admin,
  userId: string,
  permissions: string[],
): Promise<AdminIdentity> {
  const identity = await adminIdentity(admin, userId);
  if (!identity) throw new Error("Back-office access is not enabled for this account.");
  if (!permissions.some((p) => identity.permissions.includes(p))) {
    throw new Error(`Your role does not allow ${permissions.join(" / ")}.`);
  }
  return identity;
}

export function parseUserId(data: unknown): { userId: string } {
  const id = (data as { userId?: unknown })?.userId;
  if (typeof id !== "string" || id.length < 10) throw new Error("Missing user.");
  return { userId: id };
}

export function parseListInput(data: unknown): ListInput {
  const d = (data ?? {}) as Record<string, unknown>;
  const { userId } = parseUserId(d);
  const str = (key: string): string | null => {
    const v = d[key];
    return typeof v === "string" && v.trim() ? v.trim().slice(0, 120) : null;
  };
  return {
    userId,
    page: Math.max(Number(d["page"] ?? 1) || 1, 1),
    pageSize: Math.min(Math.max(Number(d["pageSize"] ?? 20) || 20, 5), 100),
    search: str("search"),
    from: str("from"),
    to: str("to"),
    filter: str("filter"),
  };
}

export function parseReasonAction(data: unknown): {
  userId: string;
  action: string;
  reason: string | null;
} {
  const d = (data ?? {}) as Record<string, unknown>;
  const { userId } = parseUserId(d);
  const action = typeof d["action"] === "string" ? d["action"] : "";
  if (!action) throw new Error("Missing action.");
  const reason = typeof d["reason"] === "string" ? d["reason"].trim().slice(0, 500) : "";
  return { userId, action, reason: reason || null };
}

/** Derives a stable public handle from the account email. */
export function handleFor(email: string): string {
  return `@${(email.split("@")[0] ?? "player").toLowerCase().replace(/[^a-z0-9._-]/g, "")}`;
}

export function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  const head = local.slice(0, 2);
  return `${head}${"•".repeat(Math.max(local.length - 2, 2))}@${domain}`;
}

export function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  return phone.length <= 4 ? phone : `${phone.slice(0, 3)}•••${phone.slice(-3)}`;
}

export function maskIp(ip: string | null): string | null {
  if (!ip) return null;
  const parts = ip.split(".");
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.•.•` : `${ip.slice(0, 6)}…`;
}

/** Identity block reused by every tab. */
export async function userHeader(admin: Admin, userId: string) {
  const [user, profile, kyc, wallets, risk] = await Promise.all([
    admin
      .from("users")
      .select(
        "id, account_number, email, status, country_code, date_of_birth, created_at, last_login_at, email_verified_at, phone_verified_at, mfa_enabled, real_money_enabled, play_mode",
      )
      .eq("id", userId)
      .maybeSingle(),
    admin
      .from("user_profiles")
      .select("first_name, last_name, phone, city, postal_code")
      .eq("user_id", userId)
      .maybeSingle(),
    admin
      .from("kyc_cases")
      .select("id, status, risk_level, submitted_at, reviewed_at, reviewer_id, rejection_reason")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("wallets")
      .select("currency, kind, available_amount, locked_amount")
      .eq("user_id", userId),
    admin
      .from("risk_events")
      .select("risk_score, severity")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  if (!user.data) throw new Error("User not found.");

  const real = (wallets.data ?? []).filter((w) => w.kind === "REAL");
  const balance = real.reduce((s, w) => s + num(w.available_amount) + num(w.locked_amount), 0);
  const scores = (risk.data ?? []).map((r) => r.risk_score);
  const riskScore = scores.length ? Math.max(...scores) : 0;

  return {
    id: user.data.id,
    accountNumber: user.data.account_number,
    email: user.data.email,
    handle: handleFor(user.data.email),
    firstName: profile.data?.first_name ?? null,
    lastName: profile.data?.last_name ?? null,
    phone: profile.data?.phone ?? null,
    countryCode: user.data.country_code,
    status: user.data.status,
    kycStatus: kyc.data?.status ?? "NOT_STARTED",
    riskLevel: (risk.data?.[0]?.severity as string | undefined) ?? kyc.data?.risk_level ?? "LOW",
    riskScore,
    createdAt: user.data.created_at,
    lastLoginAt: user.data.last_login_at,
    balance,
    emailVerified: !!user.data.email_verified_at,
    phoneVerified: !!user.data.phone_verified_at,
    mfaEnabled: user.data.mfa_enabled,
  };
}

/** Financial KPIs plus betting statistics — all derived from persisted rows. */
export async function userSummary(admin: Admin, userId: string) {
  const [wallets, deposits, withdrawals, bets] = await Promise.all([
    admin
      .from("wallets")
      .select("id, currency, kind, available_amount, locked_amount, status, updated_at")
      .eq("user_id", userId),
    admin
      .from("deposits")
      .select("currency, status, confirmed_amount, requested_amount, created_at")
      .eq("user_id", userId)
      .limit(2000),
    admin
      .from("withdrawals")
      .select("currency, status, amount, fee_amount, requested_at")
      .eq("user_id", userId)
      .limit(2000),
    admin
      .from("bets")
      .select("amount, payout_amount, status, cashout_multiplier, placed_at")
      .eq("user_id", userId)
      .order("placed_at", { ascending: false })
      .limit(5000),
  ]);

  const walletRows = wallets.data ?? [];
  const depositRows = deposits.data ?? [];
  const withdrawalRows = withdrawals.data ?? [];
  const betRows = bets.data ?? [];

  const available = walletRows.reduce((s, w) => s + num(w.available_amount), 0);
  const pending = walletRows.reduce((s, w) => s + num(w.locked_amount), 0);
  const totalDeposits = depositRows
    .filter((d) => d.status === "CONFIRMED")
    .reduce((s, d) => s + num(d.confirmed_amount ?? d.requested_amount), 0);
  const totalWithdrawals = withdrawalRows
    .filter((w) => w.status === "CONFIRMED")
    .reduce((s, w) => s + num(w.amount), 0);

  const wagered = betRows.reduce((s, b) => s + num(b.amount), 0);
  const wins = betRows.filter((b) => b.status === "CASHED_OUT");
  const losses = betRows.filter((b) => b.status === "LOST");
  const totalWins = wins.reduce((s, b) => s + (num(b.payout_amount) - num(b.amount)), 0);
  const totalLosses = losses.reduce((s, b) => s + num(b.amount), 0);
  const cashouts = wins.map((b) => num(b.cashout_multiplier)).filter((m) => m > 0);

  const profits = wins.map((b) => num(b.payout_amount) - num(b.amount));
  const stakes = betRows.map((b) => num(b.amount));

  const walletCurrencies = new Map<string, { available: number; pending: number }>();
  for (const w of walletRows) {
    const entry = walletCurrencies.get(w.currency) ?? { available: 0, pending: 0 };
    entry.available += num(w.available_amount);
    entry.pending += num(w.locked_amount);
    walletCurrencies.set(w.currency, entry);
  }

  const depositByCurrency = new Map<string, number>();
  for (const d of depositRows) {
    if (d.status !== "CONFIRMED") continue;
    depositByCurrency.set(
      d.currency,
      (depositByCurrency.get(d.currency) ?? 0) + num(d.confirmed_amount ?? d.requested_amount),
    );
  }
  const withdrawByCurrency = new Map<string, number>();
  for (const w of withdrawalRows) {
    if (w.status !== "CONFIRMED") continue;
    withdrawByCurrency.set(w.currency, (withdrawByCurrency.get(w.currency) ?? 0) + num(w.amount));
  }

  // Last 14 days of net result, for the overview chart.
  const byDay = new Map<string, number>();
  for (const b of betRows) {
    const day = (b.placed_at ?? "").slice(0, 10);
    if (!day) continue;
    const delta = b.status === "CASHED_OUT" ? num(b.payout_amount) - num(b.amount) : -num(b.amount);
    byDay.set(day, (byDay.get(day) ?? 0) + delta);
  }
  const trend = [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .slice(-14)
    .map(([day, value]) => ({ day, value }));

  return {
    kpis: {
      totalBalance: available + pending,
      available,
      pending,
      totalDeposits,
      totalWithdrawals,
      netDeposits: totalDeposits - totalWithdrawals,
      wagered,
      totalWins,
      totalLosses,
    },
    betting: {
      totalBets: betRows.length,
      averageBet: betRows.length ? wagered / betRows.length : 0,
      largestBet: stakes.length ? Math.max(...stakes) : 0,
      largestWin: profits.length ? Math.max(...profits) : 0,
      largestLoss: losses.length ? Math.max(...losses.map((b) => num(b.amount))) : 0,
      winLossRatio: losses.length ? wins.length / losses.length : wins.length,
      wins: wins.length,
      losses: losses.length,
      averageCashout: cashouts.length ? cashouts.reduce((s, m) => s + m, 0) / cashouts.length : 0,
      highestCashout: cashouts.length ? Math.max(...cashouts) : 0,
    },
    wallets: [...walletCurrencies.entries()].map(([currency, v]) => ({
      currency,
      available: v.available,
      pending: v.pending,
      deposited: depositByCurrency.get(currency) ?? 0,
      withdrawn: withdrawByCurrency.get(currency) ?? 0,
    })),
    trend,
  };
}

function paginate<T>(rows: T[], page: number, pageSize: number) {
  const start = (page - 1) * pageSize;
  return { rows: rows.slice(start, start + pageSize), total: rows.length };
}

function inRange(iso: string | null, from: string | null, to: string | null): boolean {
  if (!iso) return !from && !to;
  const day = iso.slice(0, 10);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

export async function userBets(admin: Admin, input: ListInput) {
  const { data } = await admin
    .from("bets")
    .select(
      "id, round_id, amount, currency, status, cashout_multiplier, payout_amount, placed_at, cashout_at",
    )
    .eq("user_id", input.userId)
    .order("placed_at", { ascending: false })
    .limit(2000);

  const roundIds = [...new Set((data ?? []).map((b) => b.round_id))];
  const { data: rounds } = roundIds.length
    ? await admin
        .from("game_rounds")
        .select("id, round_number, status, crash_multiplier")
        .in("id", roundIds)
    : { data: [] as { id: string; round_number: string; status: string; crash_multiplier: number | null }[] };

  const roundMap = new Map((rounds ?? []).map((r) => [r.id, r]));

  let rows = (data ?? []).map((b) => {
    const round = roundMap.get(b.round_id);
    const profit =
      b.status === "CASHED_OUT" ? num(b.payout_amount) - num(b.amount) : -num(b.amount);
    return {
      betId: b.id,
      roundId: b.round_id,
      roundNumber: round?.round_number ?? b.round_id.slice(0, 8),
      amount: num(b.amount),
      currency: b.currency,
      cashout: b.cashout_multiplier ? num(b.cashout_multiplier) : null,
      crashPoint: round?.crash_multiplier ? num(round.crash_multiplier) : null,
      result: b.status,
      profit: b.status === "CASHED_OUT" || b.status === "LOST" ? profit : 0,
      placedAt: b.placed_at,
      cashoutAt: b.cashout_at,
      roundStatus: round?.status ?? "UNKNOWN",
    };
  });

  if (input.filter === "WIN") rows = rows.filter((r) => r.result === "CASHED_OUT");
  if (input.filter === "LOSS") rows = rows.filter((r) => r.result === "LOST");
  if (input.search) {
    const q = input.search.toLowerCase();
    rows = rows.filter(
      (r) => r.roundNumber.toLowerCase().includes(q) || r.betId.toLowerCase().includes(q),
    );
  }
  rows = rows.filter((r) => inRange(r.placedAt, input.from, input.to));

  return paginate(rows, input.page, input.pageSize);
}

export type UnifiedTx = {
  id: string;
  type: string;
  currency: string;
  amount: number;
  fee: number;
  status: string;
  date: string;
  method: string | null;
  network: string | null;
  txHash: string | null;
};

export async function userTransactions(admin: Admin, input: ListInput) {
  const [deposits, withdrawals, bets, bonuses, manual] = await Promise.all([
    admin
      .from("deposits")
      .select("id, currency, network, provider, status, confirmed_amount, requested_amount, provider_transaction_id, created_at")
      .eq("user_id", input.userId)
      .limit(500),
    admin
      .from("withdrawals")
      .select("id, currency, network, provider, status, amount, fee_amount, provider_transaction_id, requested_at")
      .eq("user_id", input.userId)
      .limit(500),
    admin
      .from("bets")
      .select("id, currency, amount, payout_amount, status, placed_at")
      .eq("user_id", input.userId)
      .order("placed_at", { ascending: false })
      .limit(500),
    admin
      .from("bonus_transactions")
      .select("id, currency, amount, status, created_at")
      .eq("user_id", input.userId)
      .limit(200),
    admin
      .from("manual_deposit_requests")
      .select("id, currency, amount, method, status, created_at")
      .eq("user_id", input.userId)
      .limit(200),
  ]);

  const rows: UnifiedTx[] = [];

  for (const d of deposits.data ?? []) {
    rows.push({
      id: d.id,
      type: "DEPOSIT",
      currency: d.currency,
      amount: num(d.confirmed_amount ?? d.requested_amount),
      fee: 0,
      status: d.status,
      date: d.created_at,
      method: d.provider,
      network: d.network,
      txHash: d.provider_transaction_id,
    });
  }
  for (const w of withdrawals.data ?? []) {
    rows.push({
      id: w.id,
      type: "WITHDRAWAL",
      currency: w.currency,
      amount: num(w.amount),
      fee: num(w.fee_amount),
      status: w.status,
      date: w.requested_at,
      method: w.provider,
      network: w.network,
      txHash: w.provider_transaction_id,
    });
  }
  for (const b of bets.data ?? []) {
    rows.push({
      id: b.id,
      type: "BET",
      currency: b.currency,
      amount: num(b.amount),
      fee: 0,
      status: b.status,
      date: b.placed_at,
      method: "Astro Crash",
      network: null,
      txHash: null,
    });
    if (b.status === "CASHED_OUT") {
      rows.push({
        id: `${b.id}:win`,
        type: "WIN",
        currency: b.currency,
        amount: num(b.payout_amount),
        fee: 0,
        status: "COMPLETED",
        date: b.placed_at,
        method: "Astro Crash",
        network: null,
        txHash: null,
      });
    }
    if (b.status === "LOST") {
      rows.push({
        id: `${b.id}:loss`,
        type: "LOSS",
        currency: b.currency,
        amount: num(b.amount),
        fee: 0,
        status: "COMPLETED",
        date: b.placed_at,
        method: "Astro Crash",
        network: null,
        txHash: null,
      });
    }
    if (b.status === "REFUNDED") {
      rows.push({
        id: `${b.id}:refund`,
        type: "REFUND",
        currency: b.currency,
        amount: num(b.payout_amount),
        fee: 0,
        status: "COMPLETED",
        date: b.placed_at,
        method: "Astro Crash",
        network: null,
        txHash: null,
      });
    }
  }
  for (const b of bonuses.data ?? []) {
    rows.push({
      id: b.id,
      type: "BONUS",
      currency: b.currency,
      amount: num(b.amount),
      fee: 0,
      status: b.status,
      date: b.created_at,
      method: "Promotion",
      network: null,
      txHash: null,
    });
  }
  for (const m of manual.data ?? []) {
    rows.push({
      id: m.id,
      type: "DEPOSIT",
      currency: m.currency,
      amount: num(m.amount),
      fee: 0,
      status: m.status,
      date: m.created_at,
      method: m.method,
      network: "LOCAL",
      txHash: null,
    });
  }

  let filtered = rows.sort((a, b) => (a.date < b.date ? 1 : -1));
  if (input.filter) filtered = filtered.filter((r) => r.type === input.filter);
  if (input.search) {
    const q = input.search.toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r.id.toLowerCase().includes(q) ||
        (r.txHash ?? "").toLowerCase().includes(q) ||
        r.currency.toLowerCase().includes(q),
    );
  }
  filtered = filtered.filter((r) => inRange(r.date, input.from, input.to));

  return paginate(filtered, input.page, input.pageSize);
}

export async function userKyc(admin: Admin, userId: string, canSeeDocuments: boolean) {
  const [user, cases, docs] = await Promise.all([
    admin
      .from("users")
      .select("email_verified_at, phone_verified_at, country_code, date_of_birth")
      .eq("id", userId)
      .maybeSingle(),
    admin
      .from("kyc_cases")
      .select("id, status, risk_level, provider, submitted_at, reviewed_at, reviewer_id, rejection_reason, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10),
    admin
      .from("kyc_documents")
      .select("id, doc_type, file_name, status, storage_path, review_note, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  const documents = canSeeDocuments
    ? await Promise.all(
        (docs.data ?? []).map(async (d) => {
          const { data: signed } = await admin.storage
            .from("kyc-documents")
            .createSignedUrl(d.storage_path, 300);
          return {
            id: d.id,
            docType: d.doc_type,
            fileName: d.file_name,
            status: d.status,
            reviewNote: d.review_note,
            createdAt: d.created_at,
            url: signed?.signedUrl ?? null,
          };
        }),
      )
    : [];

  return {
    emailVerified: !!user.data?.email_verified_at,
    phoneVerified: !!user.data?.phone_verified_at,
    countryCode: user.data?.country_code ?? null,
    dateOfBirth: user.data?.date_of_birth ?? null,
    cases: cases.data ?? [],
    documents,
    documentCount: (docs.data ?? []).length,
    canSeeDocuments,
  };
}

export async function userSecurity(admin: Admin, userId: string) {
  const [user, sessions, events] = await Promise.all([
    admin
      .from("users")
      .select("email_verified_at, phone_verified_at, mfa_enabled, last_login_at, updated_at")
      .eq("id", userId)
      .maybeSingle(),
    admin
      .from("user_sessions")
      .select("id, device_label, user_agent, ip_address, created_at, last_seen_at, revoked_at")
      .eq("user_id", userId)
      .order("last_seen_at", { ascending: false })
      .limit(40),
    admin
      .from("audit_logs")
      .select("action, created_at, metadata")
      .eq("resource_id", userId)
      .in("action", ["auth.login_failed", "auth.password_changed", "auth.password_reset"])
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const rows = (sessions.data ?? []).map((s) => {
    const ua = s.user_agent ?? "";
    const browser = /Edg/.test(ua)
      ? "Edge"
      : /Chrome/.test(ua)
        ? "Chrome"
        : /Safari/.test(ua)
          ? "Safari"
          : /Firefox/.test(ua)
            ? "Firefox"
            : "Unknown";
    const os = /Android/.test(ua)
      ? "Android"
      : /iPhone|iPad/.test(ua)
        ? "iOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Mac OS/.test(ua)
            ? "macOS"
            : /Linux/.test(ua)
              ? "Linux"
              : "Unknown";
    return {
      id: s.id,
      device: s.device_label ?? "Unknown device",
      browser,
      os,
      ip: maskIp(s.ip_address as string | null),
      createdAt: s.created_at,
      lastSeenAt: s.last_seen_at,
      active: !s.revoked_at,
    };
  });

  return {
    emailVerified: !!user.data?.email_verified_at,
    phoneVerified: !!user.data?.phone_verified_at,
    mfaEnabled: !!user.data?.mfa_enabled,
    lastLoginAt: user.data?.last_login_at ?? null,
    passwordChangedAt:
      (events.data ?? []).find((e) => e.action === "auth.password_changed")?.created_at ?? null,
    activeSessions: rows.filter((r) => r.active).length,
    failedLogins: (events.data ?? []).filter((e) => e.action === "auth.login_failed").length,
    sessions: rows,
  };
}

export async function userRisk(admin: Admin, userId: string) {
  const [events, sessions, deposits, withdrawals, bets, rg] = await Promise.all([
    admin
      .from("risk_events")
      .select("id, event_type, risk_score, severity, status, source, description, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(25),
    admin.from("user_sessions").select("device_label, ip_address").eq("user_id", userId).limit(100),
    admin.from("deposits").select("id, created_at, status").eq("user_id", userId).limit(300),
    admin.from("withdrawals").select("id, requested_at, status").eq("user_id", userId).limit(300),
    admin.from("bets").select("amount, placed_at").eq("user_id", userId).limit(500),
    admin
      .from("responsible_gambling_limits")
      .select("self_exclusion_until, cooling_off_until")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const devices = new Set((sessions.data ?? []).map((s) => s.device_label ?? "unknown"));
  const ips = new Set((sessions.data ?? []).map((s) => String(s.ip_address ?? "unknown")));
  const depositCount = (deposits.data ?? []).length;
  const withdrawalCount = (withdrawals.data ?? []).length;
  const betCount = (bets.data ?? []).length;

  // Deterministic, fully explainable scoring. No game outcome is affected by this.
  const factors: { label: string; points: number; explanation: string }[] = [];
  if (devices.size > 3)
    factors.push({
      label: "Multiple devices",
      points: 15,
      explanation: `${devices.size} distinct devices seen on this account.`,
    });
  if (ips.size > 5)
    factors.push({
      label: "Multiple IP addresses",
      points: 10,
      explanation: `${ips.size} distinct IP addresses recorded across sessions.`,
    });
  if (withdrawalCount > depositCount && withdrawalCount > 2)
    factors.push({
      label: "Unusual withdrawal frequency",
      points: 20,
      explanation: `${withdrawalCount} withdrawals against ${depositCount} deposits.`,
    });
  if (depositCount > 5 && withdrawalCount > 5 && betCount < depositCount)
    factors.push({
      label: "Rapid deposit / withdrawal cycling",
      points: 25,
      explanation: "Funds move in and out with little betting activity in between.",
    });
  const openEvents = (events.data ?? []).filter((e) => e.status === "OPEN");
  if (openEvents.length)
    factors.push({
      label: "Open risk alerts",
      points: Math.min(openEvents.length * 10, 30),
      explanation: `${openEvents.length} unresolved risk alert(s) on this account.`,
    });
  if (rg.data?.self_exclusion_until)
    factors.push({
      label: "Self-exclusion active",
      points: 20,
      explanation: "The player is currently self-excluded.",
    });

  const derived = Math.min(
    factors.reduce((s, f) => s + f.points, 0),
    100,
  );
  const highest = Math.max(0, ...(events.data ?? []).map((e) => e.risk_score));
  const score = Math.max(derived, highest);
  const level = score >= 70 ? "HIGH" : score >= 35 ? "MEDIUM" : "LOW";

  return {
    score,
    level,
    factors,
    events: events.data ?? [],
    signals: {
      devices: devices.size,
      ips: ips.size,
      deposits: depositCount,
      withdrawals: withdrawalCount,
      bets: betCount,
    },
  };
}

export async function userResponsible(admin: Admin, userId: string) {
  const [limits, events, bets, sessions] = await Promise.all([
    admin
      .from("responsible_gambling_limits")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle(),
    admin
      .from("responsible_gambling_events")
      .select("id, event_type, effective_at, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("bets")
      .select("amount, payout_amount, status, placed_at")
      .eq("user_id", userId)
      .order("placed_at", { ascending: false })
      .limit(200),
    admin
      .from("user_sessions")
      .select("created_at, last_seen_at")
      .eq("user_id", userId)
      .order("last_seen_at", { ascending: false })
      .limit(20),
  ]);

  const betRows = bets.data ?? [];
  // Loss chasing: consecutive losses followed by a larger stake.
  let chasing = 0;
  for (let i = 1; i < betRows.length; i += 1) {
    const prev = betRows[i];
    const cur = betRows[i - 1];
    if (prev && cur && prev.status === "LOST" && num(cur.amount) > num(prev.amount) * 1.5) {
      chasing += 1;
    }
  }

  const durations = (sessions.data ?? []).map(
    (s) =>
      (new Date(s.last_seen_at).getTime() - new Date(s.created_at).getTime()) / 60000,
  );
  const avgSession = durations.length
    ? durations.reduce((s, d) => s + d, 0) / durations.length
    : 0;

  const first = betRows.at(-1)?.placed_at;
  const days = first
    ? Math.max(
        1,
        Math.round((Date.now() - new Date(first).getTime()) / 86400000),
      )
    : 1;

  return {
    limits: limits.data,
    events: events.data ?? [],
    lossChasingSignals: chasing,
    averageSessionMinutes: Math.round(avgSession),
    betsPerDay: Math.round((betRows.length / days) * 10) / 10,
  };
}

export async function userSupport(admin: Admin, userId: string) {
  const { data: tickets } = await admin
    .from("support_tickets")
    .select("id, reference, subject, category, status, priority, assigned_to, created_at, updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  const ids = (tickets ?? []).map((t) => t.id);
  const { data: messages } = ids.length
    ? await admin
        .from("support_messages")
        .select("id, ticket_id, author_type, body, internal_note, created_at")
        .in("ticket_id", ids)
        .order("created_at", { ascending: true })
        .limit(300)
    : { data: [] as { id: string; ticket_id: string; author_type: string; body: string; internal_note: boolean; created_at: string }[] };

  return {
    tickets: tickets ?? [],
    messages: messages ?? [],
  };
}

export async function userActivity(admin: Admin, userId: string) {
  const [logins, bets, deposits, withdrawals, kyc, audits, notifications] = await Promise.all([
    admin
      .from("user_sessions")
      .select("id, device_label, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30),
    admin
      .from("bets")
      .select("id, amount, currency, status, placed_at, cashout_multiplier")
      .eq("user_id", userId)
      .order("placed_at", { ascending: false })
      .limit(40),
    admin
      .from("deposits")
      .select("id, currency, requested_amount, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("withdrawals")
      .select("id, currency, amount, status, requested_at")
      .eq("user_id", userId)
      .order("requested_at", { ascending: false })
      .limit(20),
    admin
      .from("kyc_cases")
      .select("id, status, submitted_at, reviewed_at")
      .eq("user_id", userId)
      .limit(10),
    admin
      .from("audit_logs")
      .select("id, action, actor_role, created_at")
      .eq("resource_id", userId)
      .order("created_at", { ascending: false })
      .limit(40),
    admin
      .from("notifications")
      .select("id, event_type, title, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  type Event = {
    id: string;
    event: string;
    detail: string;
    source: string;
    status: string;
    at: string;
  };
  const rows: Event[] = [];

  for (const s of logins.data ?? [])
    rows.push({
      id: `login:${s.id}`,
      event: "LOGIN",
      detail: s.device_label ?? "Unknown device",
      source: "USER",
      status: "OK",
      at: s.created_at,
    });
  for (const b of bets.data ?? []) {
    rows.push({
      id: `bet:${b.id}`,
      event: "BET",
      detail: `${num(b.amount)} ${b.currency}`,
      source: "USER",
      status: b.status,
      at: b.placed_at,
    });
    if (b.status === "CASHED_OUT")
      rows.push({
        id: `cashout:${b.id}`,
        event: "CASHOUT",
        detail: `${num(b.cashout_multiplier)}x`,
        source: "SYSTEM",
        status: "OK",
        at: b.placed_at,
      });
  }
  for (const d of deposits.data ?? [])
    rows.push({
      id: `dep:${d.id}`,
      event: "DEPOSIT",
      detail: `${num(d.requested_amount)} ${d.currency}`,
      source: "USER",
      status: d.status,
      at: d.created_at,
    });
  for (const w of withdrawals.data ?? [])
    rows.push({
      id: `wd:${w.id}`,
      event: "WITHDRAWAL",
      detail: `${num(w.amount)} ${w.currency}`,
      source: "USER",
      status: w.status,
      at: w.requested_at,
    });
  for (const k of kyc.data ?? []) {
    if (k.submitted_at)
      rows.push({
        id: `kyc:${k.id}:s`,
        event: "KYC_SUBMISSION",
        detail: "Identity documents submitted",
        source: "USER",
        status: k.status,
        at: k.submitted_at,
      });
    if (k.reviewed_at)
      rows.push({
        id: `kyc:${k.id}:r`,
        event: "KYC_REVIEW",
        detail: "Case reviewed",
        source: "ADMIN",
        status: k.status,
        at: k.reviewed_at,
      });
  }
  for (const a of audits.data ?? [])
    rows.push({
      id: `audit:${a.id}`,
      event: a.action.toUpperCase(),
      detail: a.actor_role ?? "System",
      source: "ADMIN",
      status: "OK",
      at: a.created_at,
    });
  for (const n of notifications.data ?? [])
    rows.push({
      id: `note:${n.id}`,
      event: "NOTIFICATION",
      detail: n.title,
      source: "SYSTEM",
      status: "OK",
      at: n.created_at,
    });

  return rows.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 150);
}