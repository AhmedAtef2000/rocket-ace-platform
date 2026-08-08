// Server-only wallet helpers (Phase 5).
// Kept out of *.functions.ts so server-function splitting cannot strip them.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Admin = SupabaseClient<Database>;

export const DEMO_CURRENCY = "DEMO";
export const DEMO_TOPUP_AMOUNT = 1000;
export const DEMO_TOPUP_CEILING = 1000;
export const DEMO_TOPUP_COOLDOWN_MS = 60 * 60 * 1000;

export type LedgerRow = {
  id: string;
  transaction_id: string;
  entry_type: string;
  direction: Database["public"]["Enums"]["ledger_direction"];
  amount: string | number;
  currency: string;
  reference_type: string | null;
  created_at: string;
};

export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === "number" ? value : Number(value);
}

export function formatAmount(value: string | number | null | undefined, decimals = 2): string {
  return toNumber(value).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// Demo credits are free money: they must never touch a REAL wallet, and they
// are rate limited and capped so the demo economy stays meaningful.
export async function assertDemoTopupAllowed(
  admin: Admin,
  userId: string,
): Promise<{ walletId: string; amount: number }> {
  const { data: wallet, error } = await admin
    .from("wallets")
    .select("id, kind, currency, status, available_amount, locked_amount")
    .eq("user_id", userId)
    .eq("currency", DEMO_CURRENCY)
    .eq("kind", "DEMO")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!wallet) throw new Error("No demo wallet found for this account.");
  if (wallet.status !== "ACTIVE") throw new Error("Your demo wallet is not active.");

  const balance = toNumber(wallet.available_amount) + toNumber(wallet.locked_amount);
  if (balance >= DEMO_TOPUP_CEILING) {
    throw new Error(
      `Top-up is only available below ${DEMO_TOPUP_CEILING} demo credits. You still have ${formatAmount(balance)}.`,
    );
  }

  const since = new Date(Date.now() - DEMO_TOPUP_COOLDOWN_MS).toISOString();
  const { count } = await admin
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("actor_id", userId)
    .eq("action", "wallet.demo_topup")
    .gte("created_at", since);
  if ((count ?? 0) > 0) {
    throw new Error("You can top up demo credits once per hour.");
  }

  const amount = Math.min(DEMO_TOPUP_AMOUNT, DEMO_TOPUP_CEILING - balance);
  return { walletId: wallet.id, amount };
}

export async function auditWallet(
  admin: Admin,
  entry: {
    actorId: string;
    action: string;
    resourceId?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await admin.from("audit_logs").insert({
    actor_id: entry.actorId,
    actor_role: "USER",
    action: entry.action,
    resource_type: "wallets",
    resource_id: entry.resourceId ?? null,
    metadata: (entry.metadata ?? {}) as never,
  });
}
