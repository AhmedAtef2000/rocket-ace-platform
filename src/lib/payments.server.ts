// Phase 12 — crypto deposits & withdrawals.
// The provider layer is an abstraction: swap MockCryptoProvider for a real
// PSP adapter without touching the ledger, compliance or UI code below.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Admin = SupabaseClient<Database>;

export const PROVIDER_ID = "MOCK_CHAIN";
export const MANUAL_PROVIDER_ID = "MANUAL_LOCAL";
/** Above this fiat-equivalent size a withdrawal needs two approvers. */
export const DUAL_APPROVAL_THRESHOLD = 1000;
export const WITHDRAWAL_FEE_RATE = 0.01;
/** AML: every deposited unit must be wagered once before it can be withdrawn. */
export const PLAYTHROUGH_RATE = 1;
/** Minimum funding amount across every deposit rail. */
export const MIN_DEPOSIT_AMOUNT = 5;
/** Payouts are reviewed and paid within this window. */
export const WITHDRAWAL_NOTICE_HOURS = 24;

export const MANUAL_METHODS = [
  { id: "VODAFONE_CASH", label: "Vodafone Cash", payTo: "+20 100 000 0000" },
  { id: "ETISALAT_CASH", label: "Etisalat Cash", payTo: "+20 111 000 0000" },
  { id: "ORANGE_CASH", label: "Orange Cash", payTo: "+20 120 000 0000" },
] as const;

export type ManualMethodId = (typeof MANUAL_METHODS)[number]["id"];

export type NetworkOption = {
  currency: string;
  network: string;
  decimals: number;
  requiredConfirmations: number;
  minDeposit: number;
  minWithdrawal: number;
};

export interface PaymentProvider {
  readonly id: string;
  createDepositAddress(input: {
    userId: string;
    currency: string;
    network: string;
  }): Promise<{ address: string; providerTransactionId: string }>;
  submitWithdrawal(input: {
    withdrawalId: string;
    currency: string;
    network: string;
    amount: number;
    destinationAddress: string;
  }): Promise<{ providerTransactionId: string }>;
}

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Deterministic-looking but fake addresses: no real chain is contacted. */
export const MockCryptoProvider: PaymentProvider = {
  id: PROVIDER_ID,
  async createDepositAddress({ network }) {
    const prefix =
      network === "BITCOIN" ? "bc1q" : network === "TRON" ? "T" : "0x";
    return {
      address: `${prefix}${randomHex(network === "BITCOIN" ? 18 : 20)}`,
      providerTransactionId: `dep_${randomHex(12)}`,
    };
  },
  async submitWithdrawal() {
    return { providerTransactionId: `wd_${randomHex(12)}` };
  },
};

export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === "number" ? value : Number(value);
}

export function parseDepositInput(data: unknown): { currency: string; network: string } {
  const d = (data ?? {}) as { currency?: unknown; network?: unknown };
  const currency = typeof d.currency === "string" ? d.currency.toUpperCase() : "";
  const network = typeof d.network === "string" ? d.network.toUpperCase() : "";
  if (!currency || !network) throw new Error("Choose a currency and network.");
  return { currency, network };
}

export function parseWithdrawalInput(data: unknown): {
  currency: string;
  network: string;
  amount: number;
  destinationAddress: string;
} {
  const d = (data ?? {}) as Record<string, unknown>;
  const { currency, network } = parseDepositInput(d);
  const amount = Number(d["amount"]);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a valid amount.");
  const destinationAddress =
    typeof d["destinationAddress"] === "string" ? d["destinationAddress"].trim() : "";
  if (destinationAddress.length < 12 || destinationAddress.length > 128) {
    throw new Error("Enter a valid destination address.");
  }
  return { currency, network, amount, destinationAddress };
}

export async function listNetworks(admin: Admin): Promise<NetworkOption[]> {
  return listNetworksImpl(admin);
}

export function parseManualDepositInput(data: unknown): {
  method: ManualMethodId;
  currency: string;
  amount: number;
  senderNumber: string;
  reference: string | null;
  fileName: string;
  mimeType: string;
  contentBase64: string;
} {
  const d = (data ?? {}) as Record<string, unknown>;
  const method = String(d["method"] ?? "").toUpperCase() as ManualMethodId;
  if (!/^[A-Z0-9_]{2,40}$/.test(method)) throw new Error("Choose a payment method.");
  const currency = String(d["currency"] ?? "").toUpperCase();
  if (!currency) throw new Error("Choose a currency.");
  const amount = Number(d["amount"]);
  if (!Number.isFinite(amount) || amount < MIN_DEPOSIT_AMOUNT) {
    throw new Error(`The minimum deposit is ${MIN_DEPOSIT_AMOUNT}.`);
  }
  const senderNumber = String(d["senderNumber"] ?? "").trim();
  if (senderNumber.length < 6 || senderNumber.length > 32) {
    throw new Error("Enter the phone number you sent the payment from.");
  }
  const referenceRaw = String(d["reference"] ?? "").trim();
  const fileName = String(d["fileName"] ?? "").trim();
  const mimeType = String(d["mimeType"] ?? "").trim();
  const contentBase64 = String(d["contentBase64"] ?? "");
  if (!fileName || !contentBase64) throw new Error("Attach a screenshot of the transfer.");
  if (!/^(image\/(png|jpe?g|webp)|application\/pdf)$/.test(mimeType)) {
    throw new Error("Upload a JPG, PNG, WEBP or PDF file.");
  }
  return {
    method,
    currency,
    amount,
    senderNumber,
    reference: referenceRaw ? referenceRaw.slice(0, 120) : null,
    fileName: fileName.slice(0, 160),
    mimeType,
    contentBase64,
  };
}

export type PlaythroughStatus = {
  deposited: number;
  wagered: number;
  required: number;
  remaining: number;
  cleared: boolean;
};

/**
 * AML playthrough: funds must be wagered at least once before they can leave
 * the platform, so the wallet cannot be used as a pass-through for value.
 */
export async function playthroughStatus(
  admin: Admin,
  userId: string,
): Promise<PlaythroughStatus> {
  const [{ data: deposits }, { data: bets }] = await Promise.all([
    admin
      .from("deposits")
      .select("confirmed_amount")
      .eq("user_id", userId)
      .eq("status", "CONFIRMED"),
    admin.from("bets").select("amount, kind, status").eq("user_id", userId),
  ]);
  const deposited = (deposits ?? []).reduce((s, d) => s + toNumber(d.confirmed_amount), 0);
  const wagered = (bets ?? [])
    .filter((b) => b.kind === "REAL" && b.status !== "REFUNDED" && b.status !== "CANCELLED")
    .reduce((s, b) => s + toNumber(b.amount), 0);
  const required = Number((deposited * PLAYTHROUGH_RATE).toFixed(8));
  const remaining = Math.max(0, Number((required - wagered).toFixed(8)));
  return { deposited, wagered, required, remaining, cleared: remaining <= 0 };
}

export async function assertPlaythrough(admin: Admin, userId: string): Promise<void> {
  const status = await playthroughStatus(admin, userId);
  if (!status.cleared) {
    throw new Error(
      `Anti-money-laundering rules require you to wager your deposits once before withdrawing. ${status.remaining.toLocaleString()} of play remains.`,
    );
  }
}

async function listNetworksImpl(admin: Admin): Promise<NetworkOption[]> {
  const [{ data: nets, error }, { data: currencies }] = await Promise.all([
    admin
      .from("currency_networks")
      .select("currency_code, network, required_confirmations, min_deposit, min_withdrawal")
      .eq("enabled", true)
      .order("currency_code", { ascending: true }),
    admin.from("currencies").select("code, decimals").eq("enabled", true),
  ]);
  if (error) throw new Error(error.message);
  const decimals = new Map((currencies ?? []).map((c) => [c.code, c.decimals]));
  return (nets ?? []).map((n) => ({
    currency: n.currency_code,
    network: n.network,
    decimals: decimals.get(n.currency_code) ?? 2,
    requiredConfirmations: n.required_confirmations,
    minDeposit: toNumber(n.min_deposit),
    minWithdrawal: toNumber(n.min_withdrawal),
  }));
}

export async function requireNetwork(
  admin: Admin,
  currency: string,
  network: string,
): Promise<NetworkOption> {
  const found = (await listNetworks(admin)).find(
    (n) => n.currency === currency && n.network === network,
  );
  if (!found) throw new Error("That currency and network combination is not available.");
  return found;
}

/** Real-money wallets are provisioned lazily, one per currency. */
export async function ensureRealWallet(
  admin: Admin,
  userId: string,
  currency: string,
): Promise<{ id: string; status: string }> {
  const existing = await admin
    .from("wallets")
    .select("id, status")
    .eq("user_id", userId)
    .eq("currency", currency)
    .eq("kind", "REAL")
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) return existing.data;

  const created = await admin
    .from("wallets")
    .insert({ user_id: userId, currency, kind: "REAL" })
    .select("id, status")
    .single();
  if (created.error) throw new Error(created.error.message);
  return created.data;
}

/** Cooling-off and self-exclusion block all funding and payouts. */
export async function assertNotRestricted(admin: Admin, userId: string): Promise<void> {
  const { data: account } = await admin
    .from("users")
    .select("status, withdrawals_blocked")
    .eq("id", userId)
    .maybeSingle();
  if (!account || account.status === "SUSPENDED" || account.status === "CLOSED") {
    throw new Error("Your account is not active.");
  }
  if (account.withdrawals_blocked) {
    throw new Error("Withdrawals are restricted on your account. Contact support.");
  }
  const { data } = await admin
    .from("responsible_gambling_limits")
    .select("cooling_off_until, self_exclusion_until")
    .eq("user_id", userId)
    .maybeSingle();
  const now = Date.now();
  if (data?.self_exclusion_until && new Date(data.self_exclusion_until).getTime() > now) {
    throw new Error("Self-exclusion is active on this account.");
  }
  if (data?.cooling_off_until && new Date(data.cooling_off_until).getTime() > now) {
    throw new Error("A cooling-off period is active on this account.");
  }
}

/** Deposit limits are enforced on credited value, per rolling window. */
export async function assertDepositLimits(
  admin: Admin,
  userId: string,
  currency: string,
  amount: number,
): Promise<void> {
  const { data: limits } = await admin
    .from("responsible_gambling_limits")
    .select("deposit_daily_limit, deposit_weekly_limit, deposit_monthly_limit")
    .eq("user_id", userId)
    .maybeSingle();
  if (!limits) return;

  const windows: { key: keyof typeof limits; days: number; label: string }[] = [
    { key: "deposit_daily_limit", days: 1, label: "daily" },
    { key: "deposit_weekly_limit", days: 7, label: "weekly" },
    { key: "deposit_monthly_limit", days: 30, label: "monthly" },
  ];

  for (const w of windows) {
    const limit = toNumber(limits[w.key]);
    if (!limit) continue;
    const since = new Date(Date.now() - w.days * 86_400_000).toISOString();
    const { data: rows } = await admin
      .from("deposits")
      .select("confirmed_amount")
      .eq("user_id", userId)
      .eq("currency", currency)
      .eq("status", "CONFIRMED")
      .gte("confirmed_at", since);
    const used = (rows ?? []).reduce((sum, r) => sum + toNumber(r.confirmed_amount), 0);
    if (used + amount > limit) {
      throw new Error(
        `This deposit would exceed your ${w.label} deposit limit of ${limit} ${currency}.`,
      );
    }
  }
}

export type CreditResult = { credited: boolean; transactionId: string | null };

/**
 * Credits a confirmed on-chain deposit exactly once. Idempotency is anchored on
 * deposits.credited_transaction_id, so replayed webhooks are harmless.
 */
export async function creditDeposit(
  admin: Admin,
  depositId: string,
  confirmedAmount: number,
  confirmations: number,
): Promise<CreditResult> {
  const { data: deposit, error } = await admin
    .from("deposits")
    .select(
      "id, user_id, wallet_id, currency, network, status, credited_transaction_id, required_confirmations",
    )
    .eq("id", depositId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!deposit) throw new Error("Deposit not found.");
  if (deposit.credited_transaction_id) {
    return { credited: false, transactionId: deposit.credited_transaction_id };
  }

  const enough = confirmations >= deposit.required_confirmations;
  if (!enough) {
    await admin
      .from("deposits")
      .update({ status: "CONFIRMING", confirmations, confirmed_amount: confirmedAmount })
      .eq("id", deposit.id);
    return { credited: false, transactionId: null };
  }

  await assertNotRestricted(admin, deposit.user_id);
  await assertDepositLimits(admin, deposit.user_id, deposit.currency, confirmedAmount);

  const wallet =
    deposit.wallet_id ?? (await ensureRealWallet(admin, deposit.user_id, deposit.currency)).id;

  const { data: transactionId, error: postError } = await admin.rpc("post_wallet_transaction", {
    _wallet_id: wallet,
    _direction: "CREDIT",
    _amount: confirmedAmount,
    _entry_type: "DEPOSIT",
    _counter_account_type: "EXTERNAL_PAYMENT",
    _reference_type: "deposits",
    _reference_id: deposit.id,
    _metadata: { network: deposit.network, provider: PROVIDER_ID } as never,
  });
  if (postError) throw new Error(postError.message);

  const { error: updateError } = await admin
    .from("deposits")
    .update({
      status: "CONFIRMED",
      confirmations,
      confirmed_amount: confirmedAmount,
      wallet_id: wallet,
      credited_transaction_id: transactionId as unknown as string,
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", deposit.id)
    .is("credited_transaction_id", null);
  if (updateError) throw new Error(updateError.message);

  await admin.from("notifications").insert({
    user_id: deposit.user_id,
    event_type: "deposit.confirmed",
    title: "Deposit confirmed",
    body: `${confirmedAmount} ${deposit.currency} was credited to your wallet.`,
  });

  return { credited: true, transactionId: transactionId as unknown as string };
}

export async function auditPayments(
  admin: Admin,
  entry: {
    actorId: string | null;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await admin.from("audit_logs").insert({
    actor_id: entry.actorId,
    actor_role: entry.actorId ? "USER" : "SYSTEM",
    action: entry.action,
    resource_type: entry.resourceType,
    resource_id: entry.resourceId ?? null,
    metadata: (entry.metadata ?? {}) as never,
  });
}