// Server-only helpers for the crash game: validation, eligibility, view mapping.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { EngineRound } from "@/lib/game-engine.server";

type Admin = SupabaseClient<Database>;

export function betInput(data: unknown): { amount: number; autoCashout: number | null } {
  const d = (data ?? {}) as { amount?: unknown; autoCashout?: unknown };
  const amount = Number(d.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a valid stake.");

  let autoCashout: number | null = null;
  if (d.autoCashout !== null && d.autoCashout !== undefined && d.autoCashout !== "") {
    const value = Number(d.autoCashout);
    if (!Number.isFinite(value) || value <= 1) throw new Error("Auto cash-out must be above 1.00x.");
    autoCashout = Math.floor(value * 100) / 100;
  }

  return { amount: Math.floor(amount * 100) / 100, autoCashout };
}

export function cashOutInput(data: unknown): { betId: string } {
  const betId = (data as { betId?: unknown } | undefined)?.betId;
  if (typeof betId !== "string" || !/^[0-9a-f-]{36}$/i.test(betId)) {
    throw new Error("Invalid bet reference.");
  }
  return { betId };
}

/** Account status plus responsible-gambling gates, checked before every stake. */
export async function assertCanPlay(admin: Admin, userId: string): Promise<void> {
  const [{ data: user }, { data: rg }] = await Promise.all([
    admin.from("users").select("status").eq("id", userId).maybeSingle(),
    admin
      .from("responsible_gambling_limits")
      .select("cooling_off_until, self_exclusion_until")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (!user || user.status !== "ACTIVE") throw new Error("Your account is not active.");
  const now = Date.now();
  if (rg?.self_exclusion_until && new Date(rg.self_exclusion_until).getTime() > now) {
    throw new Error("Play is blocked while your self-exclusion is active.");
  }
  if (rg?.cooling_off_until && new Date(rg.cooling_off_until).getTime() > now) {
    throw new Error("Play is blocked while your cooling-off period is active.");
  }
}

/** Public view of a round — the crash point only appears once it has happened. */
export function roundView(round: EngineRound | null) {
  if (!round) return null;
  return {
    id: round.id,
    number: round.round_number,
    status: round.status,
    bettingOpenAt: round.betting_open_at,
    startedAt: round.started_at,
    crashedAt: round.crashed_at,
    settledAt: round.settled_at,
    crash:
      round.status === "CRASHED" || round.status === "SETTLING" || round.status === "SETTLED"
        ? Number(round.crash_multiplier ?? 0)
        : null,
    totalWagered: Number(round.total_wagered ?? 0),
  };
}
