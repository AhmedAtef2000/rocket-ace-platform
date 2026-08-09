// Server-only helpers for the crash game: validation, eligibility, view mapping.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { EngineRound } from "@/lib/game-engine.server";
import { validateStake } from "@/lib/stake";

type Admin = SupabaseClient<Database>;

export function betInput(data: unknown): { amount: number; autoCashout: number | null } {
  const d = (data ?? {}) as { amount?: unknown; autoCashout?: unknown };
  // Structural check only; the min/max rules come from the active config later.
  const stake = validateStake(d.amount, { minBet: 0.01 });
  if (!stake.ok) throw new Error(stake.message);

  let autoCashout: number | null = null;
  if (d.autoCashout !== null && d.autoCashout !== undefined && d.autoCashout !== "") {
    const value = Number(d.autoCashout);
    if (!Number.isFinite(value) || value <= 1) throw new Error("Auto cash-out must be above 1.00x.");
    autoCashout = Math.floor(value * 100) / 100;
  }

  return { amount: stake.amount, autoCashout };
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

/** Anonymised player handle for the public live-bet table. */
export function maskHandle(userId: string): string {
  return `****${userId.replace(/-/g, "").slice(-4)}`;
}

export type LiveBetRow = {
  id: string;
  mine: boolean;
  handle: string;
  amount: number;
  status: string;
  multiplier: number | null;
  payout: number | null;
};

function hashInt(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 100000) / 100000;
  };
}

/**
 * Pads the live table with deterministic simulated players so a new platform
 * still shows an active round. Derived from the round id, so every client sees
 * the same rows for the same round.
 */
export function simulatedLiveBets(
  roundId: string,
  status: string,
  crash: number | null,
  count: number,
): LiveBetRow[] {
  if (count <= 0) return [];
  const rnd = hashInt(roundId);
  const rows: LiveBetRow[] = [];
  // Each round gets its own cash-out appetite, so the winner/loser split
  // changes from round to round instead of looking identical every time.
  const eagerness = 0.35 + rnd() * 0.45;
  for (let i = 0; i < count; i += 1) {
    const amount = Math.round((5 + rnd() * 195) * 100) / 100;
    const target = Math.round((1.05 + rnd() * (2 + rnd() * 8)) * 100) / 100;
    let rowStatus = "ACTIVE";
    let multiplier: number | null = null;
    let payout: number | null = null;
    if (status === "RUNNING" && rnd() < eagerness) {
      rowStatus = "CASHED_OUT";
      multiplier = target;
      payout = Math.round(amount * target * 100) / 100;
    } else if (crash !== null) {
      if (target <= crash) {
        rowStatus = "CASHED_OUT";
        multiplier = target;
        payout = Math.round(amount * target * 100) / 100;
      } else {
        rowStatus = "LOST";
        payout = 0;
      }
    }
    rows.push({
      id: `sim-${roundId}-${i}`,
      mine: false,
      handle: `****${Math.floor(rnd() * 100000)
        .toString(36)
        .padStart(4, "0")
        .slice(-4)}`,
      amount,
      status: rowStatus,
      multiplier,
      payout,
    });
  }
  return rows;
}
