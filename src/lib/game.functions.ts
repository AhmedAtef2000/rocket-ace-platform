import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  assertCanPlay,
  betInput,
  cashOutInput,
  maskHandle,
  roundView,
  simulatedLiveBets,
} from "@/lib/game.server";

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

    const lastSettled = await supabaseAdmin
      .from("bets")
      .select("amount, payout_amount, status, cashout_multiplier, round_id")
      .eq("user_id", userId)
      .in("status", ["CASHED_OUT", "LOST", "REFUNDED"])
      .order("placed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const liveBets = round
      ? await supabaseAdmin
          .from("bets")
          .select("id, user_id, amount, status, cashout_multiplier, payout_amount")
          .eq("round_id", round.id)
          .order("placed_at", { ascending: true })
          .limit(50)
      : { data: null };

    const realBets = (liveBets.data ?? []).map((b) => ({
      id: b.id,
      mine: b.user_id === userId,
      handle: maskHandle(b.user_id),
      amount: Number(b.amount),
      status: b.status as string,
      multiplier: b.cashout_multiplier === null ? null : Number(b.cashout_multiplier),
      payout: b.payout_amount === null ? null : Number(b.payout_amount),
    }));
    const roundViewData = roundView(round);
    const padded = round
      ? simulatedLiveBets(
          round.id,
          round.status,
          roundViewData?.crash ?? null,
          Math.max(0, 8 - realBets.length),
        )
      : [];

    return {
      serverTime,
      config: {
        minBet: config.min_bet,
        maxBet: config.max_bet,
        bettingDurationMs: config.betting_duration_ms,
        growthRate: config.crash_growth_rate,
      },
      round: roundViewData,
      fairness: seed.data ?? null,
      bet: bet.data ?? null,
      lastResult: lastSettled.data
        ? {
            stake: Number(lastSettled.data.amount),
            payout: Number(lastSettled.data.payout_amount ?? 0),
            net: Number(lastSettled.data.payout_amount ?? 0) - Number(lastSettled.data.amount),
            status: lastSettled.data.status as string,
            multiplier:
              lastSettled.data.cashout_multiplier === null
                ? null
                : Number(lastSettled.data.cashout_multiplier),
          }
        : null,
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
      liveBets: [...realBets, ...padded],
    };
  });

export const placeBet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => betInput(data))
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { tickEngine } = await import("@/lib/game-engine.server");
    const { enforceRateLimit } = await import("@/lib/rate-limit.server");

    await enforceRateLimit(supabaseAdmin, "bet.place", userId);
    await assertCanPlay(supabaseAdmin, userId);
    const { round } = await tickEngine(supabaseAdmin);
    if (!round || round.status !== "BETTING") {
      throw new Error("Betting is closed for this round — wait for the next one.");
    }

    // Config-driven limits, so the API and the form reject the same values.
    const { validateStake } = await import("@/lib/stake");
    const { data: config } = await supabaseAdmin
      .from("game_configurations")
      .select("min_bet, max_bet")
      .eq("active", true)
      .maybeSingle();
    const stake = validateStake(data.amount, {
      minBet: Number(config?.min_bet ?? 5),
      maxBet: config?.max_bet == null ? null : Number(config.max_bet),
    });
    if (!stake.ok) throw new Error(stake.message);

    const args = {
      _user_id: userId,
      _round_id: round.id,
      _amount: stake.amount,
      ...(data.autoCashout === null ? {} : { _auto_cashout: data.autoCashout }),
    };
    const { data: betId, error } = await supabaseAdmin.rpc("game_place_bet", args);
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
