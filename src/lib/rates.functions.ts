import { createServerFn } from "@tanstack/react-start";

export type RateMap = Record<string, number>;

/** Conservative fallbacks so the UI never renders an empty conversion. */
const FALLBACK: RateMap = { USDT: 1, USDC: 1, USD: 1, BTC: 65000, ETH: 3200 };

/**
 * USD price per unit for every asset the wallet supports.
 * Stablecoins are pinned to 1; BTC/ETH come from a public price feed.
 */
export const getCryptoRates = createServerFn({ method: "GET" }).handler(async () => {
  const rates: RateMap = { ...FALLBACK };
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd",
      { headers: { accept: "application/json" } },
    );
    if (res.ok) {
      const json = (await res.json()) as Record<string, { usd?: number }>;
      if (typeof json["bitcoin"]?.usd === "number") rates["BTC"] = json["bitcoin"].usd;
      if (typeof json["ethereum"]?.usd === "number") rates["ETH"] = json["ethereum"].usd;
    }
  } catch {
    // Keep fallbacks — a stale price is better than a blank balance.
  }
  return { rates, fetchedAt: new Date().toISOString() };
});
