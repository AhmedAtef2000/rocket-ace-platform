import { describe, expect, it } from "vitest";
import { buildSeries, emptySeries, topPlayers } from "@/lib/analytics.server";
import { severityFor } from "@/lib/risk.server";

describe("analytics aggregation", () => {
  it("produces one bucket per day", () => {
    expect(emptySeries(14)).toHaveLength(14);
  });

  it("computes GGR as wagered minus payout", () => {
    const today = new Date().toISOString();
    const series = buildSeries(7, [
      { created_at: today, total_wagered: "100", total_payout: "60" },
      { created_at: today, total_wagered: "50", total_payout: "20" },
    ]);
    const bucket = series[series.length - 1]!;
    expect(bucket.rounds).toBe(2);
    expect(bucket.wagered).toBe(150);
    expect(bucket.ggr).toBe(70);
  });

  it("ranks players by volume wagered", () => {
    const rows = [
      { user_id: "a", amount: 10, payout_amount: 0 },
      { user_id: "b", amount: 100, payout_amount: 250 },
      { user_id: "a", amount: 20, payout_amount: 5 },
    ];
    const top = topPlayers(rows, 2);
    expect(top[0]!.userId).toBe("b");
    expect(top[1]!.wagered).toBe(30);
    expect(top[0]!.net).toBe(-150);
  });
});

describe("risk severity bands", () => {
  it("escalates with score", () => {
    expect(severityFor(0)).toBe("LOW");
    expect(severityFor(30)).toBe("MEDIUM");
    expect(severityFor(55)).toBe("HIGH");
    expect(severityFor(95)).toBe("REVIEW_REQUIRED");
  });
});
