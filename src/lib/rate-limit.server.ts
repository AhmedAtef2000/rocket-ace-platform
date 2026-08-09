// Phase 18 — server-side throttling for sensitive actions.
// Buckets live in Postgres so limits hold across every edge instance.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type RateLimitRule = { limit: number; windowSeconds: number; message?: string };

export const RATE_LIMITS = {
  "deposit.create": { limit: 10, windowSeconds: 600 },
  "deposit.simulate": { limit: 20, windowSeconds: 600 },
  "withdrawal.request": { limit: 5, windowSeconds: 3600 },
  "wallet.demo_topup": { limit: 5, windowSeconds: 3600 },
  "support.ticket": { limit: 5, windowSeconds: 3600 },
  "support.reply": { limit: 30, windowSeconds: 3600 },
  "bet.place": { limit: 120, windowSeconds: 60 },
} satisfies Record<string, RateLimitRule>;

export type RateLimitAction = keyof typeof RATE_LIMITS;

function humanDelay(seconds: number): string {
  if (seconds <= 60) return `${Math.max(seconds, 1)}s`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)} min`;
  return `${Math.ceil(seconds / 3600)}h`;
}

/**
 * Consumes one token for (action, subject). Throws a player-safe error when the
 * bucket is exhausted — never reveals internal counters.
 */
export async function enforceRateLimit(
  client: SupabaseClient<Database>,
  action: RateLimitAction,
  subject: string,
): Promise<void> {
  const rule = RATE_LIMITS[action];
  const { data, error } = await client.rpc("rl_consume", {
    _key: `${action}:${subject}`,
    _limit: rule.limit,
    _window_seconds: rule.windowSeconds,
  });
  // Fail closed only on an explicit denial; an infrastructure error must not
  // silently disable the limiter, so it is surfaced.
  if (error) throw new Error(error.message);

  const row = Array.isArray(data) ? data[0] : data;
  if (row && row.allowed === false) {
    throw new Error(
      `Too many attempts. Please try again in ${humanDelay(Number(row.retry_after_seconds ?? 60))}.`,
    );
  }
}
