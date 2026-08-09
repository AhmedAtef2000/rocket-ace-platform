// Read-only back-office resource registry (server only).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Admin = SupabaseClient<Database>;
type Query = ReturnType<ReturnType<Admin["from"]>["select"]>;

export type OpsDefinition = {
  table: string;
  select: string;
  columns: string[];
  orderBy: string;
  ascending?: boolean;
  permission: string;
  refine?: (query: Query) => Query;
};

export const OPS_RESOURCES = {
  transactions: {
    table: "payment_transactions",
    select: "id, provider, direction, reference_type, reference_id, signature_verified, processed_at, created_at",
    columns: ["id", "provider", "direction", "reference_type", "reference_id", "signature_verified", "processed_at", "created_at"],
    orderBy: "created_at",
    permission: "finance.view",
  },
  wallets: {
    table: "wallets",
    select: "id, user_id, currency, kind, available_amount, locked_amount, status, updated_at",
    columns: ["id", "user_id", "currency", "kind", "available_amount", "locked_amount", "status", "updated_at"],
    orderBy: "updated_at",
    permission: "finance.view",
  },
  vip: {
    table: "wallets",
    select: "user_id, currency, kind, available_amount, locked_amount, status, updated_at",
    columns: ["user_id", "currency", "kind", "available_amount", "locked_amount", "status", "updated_at"],
    orderBy: "available_amount",
    permission: "finance.view",
    refine: (q: Query) => q.eq("kind", "REAL"),
  },
  bets: {
    table: "bets",
    select: "id, user_id, round_id, amount, currency, status, cashout_multiplier, payout_amount, placed_at",
    columns: ["id", "user_id", "round_id", "amount", "currency", "status", "cashout_multiplier", "payout_amount", "placed_at"],
    orderBy: "placed_at",
    permission: "analytics.view",
  },
  rounds: {
    table: "game_rounds",
    select: "id, round_number, status, crash_multiplier, total_wagered, total_payout, started_at, crashed_at",
    columns: ["round_number", "status", "crash_multiplier", "total_wagered", "total_payout", "started_at", "crashed_at"],
    orderBy: "round_number",
    permission: "analytics.view",
  },
  gamesettings: {
    table: "game_configurations",
    select: "version, min_bet, max_bet, max_payout, max_exposure, betting_duration_ms, house_edge_bps, max_crash_multiplier, active, created_at",
    columns: ["version", "min_bet", "max_bet", "max_payout", "max_exposure", "betting_duration_ms", "house_edge_bps", "max_crash_multiplier", "active", "created_at"],
    orderBy: "version",
    permission: "analytics.view",
  },
  fairness: {
    table: "provably_fair_seeds",
    select: "*",
    columns: [],
    orderBy: "created_at",
    permission: "analytics.view",
  },
  limits: {
    table: "responsible_gambling_limits",
    select: "user_id, deposit_daily_limit, loss_daily_limit, session_limit_minutes, cooling_off_until, self_exclusion_until, updated_at",
    columns: ["user_id", "deposit_daily_limit", "loss_daily_limit", "session_limit_minutes", "cooling_off_until", "self_exclusion_until", "updated_at"],
    orderBy: "updated_at",
    permission: "user.view",
  },
  banned: {
    table: "users",
    select: "id, account_number, email, status, country_code, last_login_at, created_at",
    columns: ["account_number", "email", "status", "country_code", "last_login_at", "created_at"],
    orderBy: "updated_at",
    permission: "user.view",
    refine: (q: Query) => q.neq("status", "ACTIVE"),
  },
  ips: {
    table: "user_sessions",
    select: "user_id, ip_address, device_label, created_at, last_seen_at, revoked_at",
    columns: ["user_id", "ip_address", "device_label", "created_at", "last_seen_at", "revoked_at"],
    orderBy: "last_seen_at",
    permission: "risk.view",
  },
  devices: {
    table: "user_sessions",
    select: "user_id, device_label, user_agent, last_seen_at, revoked_at",
    columns: ["user_id", "device_label", "user_agent", "last_seen_at", "revoked_at"],
    orderBy: "last_seen_at",
    permission: "risk.view",
  },
  promotions: {
    table: "bonus_campaigns",
    select: "id, code, name, bonus_type, currency, match_percent, max_bonus_amount, wagering_multiplier, active, starts_at, expires_at",
    columns: ["code", "name", "bonus_type", "currency", "match_percent", "max_bonus_amount", "wagering_multiplier", "active", "starts_at", "expires_at"],
    orderBy: "created_at",
    permission: "analytics.view",
  },
  bonuses: {
    table: "bonus_transactions",
    select: "id, user_id, campaign_id, currency, amount, wagering_required, wagering_completed, status, expires_at",
    columns: ["user_id", "campaign_id", "currency", "amount", "wagering_required", "wagering_completed", "status", "expires_at"],
    orderBy: "created_at",
    permission: "finance.view",
  },
  messages: {
    table: "support_messages",
    select: "*",
    columns: [],
    orderBy: "created_at",
    permission: "support.view",
  },
  announcements: {
    table: "notifications",
    select: "id, user_id, event_type, title, body, read_at, created_at",
    columns: ["event_type", "title", "body", "user_id", "read_at", "created_at"],
    orderBy: "created_at",
    permission: "support.view",
  },
  currencies: {
    table: "currencies",
    select: "code, display_name, decimals, is_crypto, enabled, created_at",
    columns: ["code", "display_name", "decimals", "is_crypto", "enabled", "created_at"],
    orderBy: "code",
    ascending: true,
    permission: "analytics.view",
  },
  methods: {
    table: "currency_networks",
    select: "id, currency_code, network, required_confirmations, min_deposit, min_withdrawal, enabled",
    columns: ["currency_code", "network", "required_confirmations", "min_deposit", "min_withdrawal", "enabled"],
    orderBy: "currency_code",
    ascending: true,
    permission: "analytics.view",
  },
  admins: {
    table: "admin_users",
    select: "id, user_id, role_id, active, created_at, updated_at",
    columns: ["user_id", "role_id", "active", "created_at", "updated_at"],
    orderBy: "created_at",
    permission: "admin.manage",
  },
  syslogs: {
    table: "audit_logs",
    select: "id, action, resource_type, resource_id, actor_role, ip_address, created_at",
    columns: ["action", "resource_type", "resource_id", "actor_role", "ip_address", "created_at"],
    orderBy: "created_at",
    permission: "audit.view",
  },
} as const satisfies Record<string, OpsDefinition>;

export type OpsResource = keyof typeof OPS_RESOURCES;

export function parseOpsInput(data: unknown): { resource: OpsResource; limit: number } {
  const raw = (data ?? {}) as { resource?: string; limit?: number };
  const resource = raw.resource as OpsResource;
  if (!resource || !(resource in OPS_RESOURCES)) throw new Error("Unknown back-office resource.");
  const limit = Math.min(Math.max(Number(raw.limit ?? 50) || 50, 1), 200);
  return { resource, limit };
}
