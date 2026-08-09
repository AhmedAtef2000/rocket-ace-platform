/**
 * Single source of truth for bet-amount validation.
 * Shared by the client form and the server function so both surface identical
 * error codes and messages.
 */

export type StakeErrorCode = "STAKE_NOT_A_NUMBER" | "STAKE_BELOW_MIN" | "STAKE_ABOVE_MAX";

export type StakeRules = { minBet: number; maxBet?: number | null };

export type StakeResult =
  | { ok: true; amount: number }
  | { ok: false; code: StakeErrorCode; message: string };

export function money(value: number): string {
  return value.toFixed(2);
}

/** Truncates to 2 decimals (never rounds up in the player's favour). */
export function normalizeStake(value: number): number {
  return Math.floor(value * 100) / 100;
}

export function validateStake(raw: unknown, rules: StakeRules): StakeResult {
  const text = typeof raw === "string" ? raw.trim() : raw;
  const amount =
    typeof text === "number" ? text : text === "" || text == null ? Number.NaN : Number(text);

  if (!Number.isFinite(amount)) {
    return {
      ok: false,
      code: "STAKE_NOT_A_NUMBER",
      message: "Enter a bet amount as a number, for example 5.31.",
    };
  }

  const normalized = normalizeStake(amount);
  if (normalized < rules.minBet) {
    return {
      ok: false,
      code: "STAKE_BELOW_MIN",
      message: `Bet amount must be at least ${money(rules.minBet)}.`,
    };
  }
  if (rules.maxBet != null && Number.isFinite(rules.maxBet) && normalized > rules.maxBet) {
    return {
      ok: false,
      code: "STAKE_ABOVE_MAX",
      message: `Bet amount must be ${money(rules.maxBet)} or less.`,
    };
  }
  return { ok: true, amount: normalized };
}