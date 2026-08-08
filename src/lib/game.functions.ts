import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCanPlay, betInput, cashOutInput, roundView } from "@/lib/game.server";

export const getGameState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { tickEngine } = await import("@/lib/game-engine.server");

    const { config, round, serverTime } = await tickEngine(supabaseAdmin);

    const [bet, wallet, history] = await Promise.all([
      round
        ? supabaseAdmin
            .from("bets")
            .select("id, amount, status, auto_cashout_multiplier, cashout_multiplier, payout_amount")
            .eq("round_id", round.id)
            .eq("user_id", userId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabaseAdmin
        .from("wallets")
        .select("id, available_amount, locked_amount, currency")
        .eq("user_id", userId)
        .eq("kind", "DEMO")
        .maybeSingle(),
      supabaseAdmin
        .from("game_results")
        .select("round_id, crash_multiplier, created_at")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const seed = round
      ? await supabaseAdmin
          .from("provably_fair_seeds")
          .select("server_seed_hash, client_seed, nonce, server_seed_revealed")
          .eq("round_id", round.id)
          .maybeSingle()
      : { data: null };

    return {
      serverTime,
      config: {
        minBet: config.min_bet,
        maxBet: config.max_bet,
        bettingDurationMs: config.betting_duration_ms,
        growthRate: config.crash_growth_rate,
      },
      round: roundView(round),
      fairness: seed.data ?? null,
      bet: bet.data ?? null,
      wallet: wallet.data
        ? {
            available: Number(wallet.data.available_amount),
            locked: Number(wallet.data.locked_amount),
            currency: wallet.data.currency,
          }
        : null,
      history: (history.data ?? []).map((h) => ({
        roundId: h.round_id,
        crash: Number(h.crash_multiplier),
      })),
    };
  });

export const placeBet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => betInput(data))
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { tickEngine } = await import("@/lib/game-engine.server");

    await assertCanPlay(supabaseAdmin, userId);
    const { round } = await tickEngine(supabaseAdmin);
    if (!round || round.status !== "BETTING") {
      throw new Error("Betting is closed for this round — wait for the next one.");
    }

    const { data: betId, error } = await supabaseAdmin.rpc("game_place_bet", {
      _user_id: userId,
      _round_id: round.id,
      _amount: data.amount,
      _auto_cashout: data.autoCashout ?? undefined,
    });
    if (error) throw new Error(friendly(error.message));

    return { betId, roundId: round.id };
  });

export const cashOut = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => cashOutInput(data))
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { tickEngine, liveMultiplier } = await import("@/lib/game-engine.server");

    const { round, config } = await tickEngine(supabaseAdmin);
    if (!round || round.status !== "RUNNING") {
      throw new Error("Too late — the round already crashed.");
    }

    const multiplier = Math.max(1, Math.floor(liveMultiplier(round, config) * 100) / 100);
    const { data: result, error } = await supabaseAdmin.rpc("game_cash_out", {
      _user_id: userId,
      _bet_id: data.betId,
      _multiplier: multiplier,
    });
    if (error) throw new Error(friendly(error.message));

    return result as { bet_id: string; multiplier: number; payout: number };
  });

function friendly(message: string): string {
  const map: Record<string, string> = {
    BETTING_CLOSED: "Betting is closed for this round.",
    BET_ALREADY_PLACED: "You already have a bet in this round.",
    BET_OUT_OF_RANGE: "That stake is outside the allowed bet range.",
    AUTO_CASHOUT_TOO_LOW: "Auto cash-out must be above 1.00x.",
    INSUFFICIENT_FUNDS: "Not enough credits in your demo wallet.",
    WALLET_NOT_FOUND: "No demo wallet found for this account.",
    BET_NOT_ACTIVE: "That bet is already settled.",
    ROUND_NOT_RUNNING: "Too late — the round already crashed.",
    ROUND_EXPOSURE_LIMIT: "This round has reached its exposure limit.",
  };
  const key = Object.keys(map).find((code) => message.includes(code));
  return key ? map[key]! : message;
}
