import { describe, expect, it } from "vitest";

import { normalizeStake, validateStake } from "@/lib/stake";
import { betInput } from "@/lib/game.server";
import { parseAccountCurrency, parseRegistration } from "@/lib/registration.server";

const RULES = { minBet: 5, maxBet: null };

describe("validateStake", () => {
  it("accepts decimal stakes at or above the minimum", () => {
    expect(validateStake("5", RULES)).toEqual({ ok: true, amount: 5 });
    expect(validateStake("5.31", RULES)).toEqual({ ok: true, amount: 5.31 });
    expect(validateStake(1000000, RULES)).toEqual({ ok: true, amount: 1000000 });
  });

  it("truncates beyond two decimals instead of rounding up", () => {
    expect(normalizeStake(5.999)).toBe(5.99);
    expect(validateStake("5.999", RULES)).toEqual({ ok: true, amount: 5.99 });
  });

  it("rejects stakes below the minimum", () => {
    for (const value of ["4.99", 0.1, 1, "0"]) {
      const result = validateStake(value, RULES);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("STAKE_BELOW_MIN");
        expect(result.message).toBe("Bet amount must be at least 5.00.");
      }
    }
  });

  it("rejects negative stakes", () => {
    const result = validateStake("-10", RULES);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("STAKE_BELOW_MIN");
  });

  it("rejects non-numeric input", () => {
    for (const value of ["", "   ", "abc", "5abc", null, undefined, {}, Number.NaN, Infinity]) {
      const result = validateStake(value, RULES);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("STAKE_NOT_A_NUMBER");
        expect(result.message).toBe("Enter a bet amount as a number, for example 5.31.");
      }
    }
  });

  it("honours a maximum when the config sets one", () => {
    const result = validateStake("501", { minBet: 5, maxBet: 500 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("STAKE_ABOVE_MAX");
      expect(result.message).toBe("Bet amount must be 500.00 or less.");
    }
  });
});

describe("betInput (server function validator)", () => {
  it("accepts a valid stake and optional auto cash-out", () => {
    expect(betInput({ amount: "7.25", autoCashout: "2.5" })).toEqual({
      amount: 7.25,
      autoCashout: 2.5,
      mode: "DEMO",
    });
    expect(betInput({ amount: 7 })).toEqual({ amount: 7, autoCashout: null, mode: "DEMO" });
  });

  it("throws the standardized message for non-numeric stakes", () => {
    expect(() => betInput({ amount: "abc" })).toThrow(
      "Enter a bet amount as a number, for example 5.31.",
    );
    expect(() => betInput({})).toThrow("Enter a bet amount as a number, for example 5.31.");
  });

  it("throws for zero and negative stakes", () => {
    expect(() => betInput({ amount: 0 })).toThrow(/at least/);
    expect(() => betInput({ amount: -5 })).toThrow(/at least/);
  });

  it("rejects auto cash-out at or below 1.00x", () => {
    expect(() => betInput({ amount: 10, autoCashout: "1" })).toThrow(
      "Auto cash-out must be above 1.00x.",
    );
  });
});

describe("registration currency", () => {
  it("accepts the supported currencies case-insensitively", () => {
    expect(parseAccountCurrency("usd")).toBe("USD");
    expect(parseAccountCurrency("EUR")).toBe("EUR");
    expect(parseAccountCurrency(" egp ")).toBe("EGP");
  });

  it("rejects unsupported currencies", () => {
    expect(() => parseAccountCurrency("BTC")).toThrow("Select a supported account currency.");
    expect(() => parseAccountCurrency("")).toThrow();
  });

  it("requires a currency on the registration payload", () => {
    const base = {
      firstName: "Ahmed",
      lastName: "Atef",
      dateOfBirth: "1995-01-01",
      email: "Player@Example.com",
      phone: "+20 100 000 0000",
    };
    expect(() => parseRegistration(base)).toThrow("Select a supported account currency.");
    const parsed = parseRegistration({ ...base, currency: "EGP" });
    expect(parsed.currency).toBe("EGP");
    expect(parsed.email).toBe("player@example.com");
    expect(parsed.phone).toBe("+201000000000");
  });
});