// Phase 16 — reporting aggregations. Pure helpers so they stay unit-testable and
// never leak provider clients across the server-function boundary.

export type DayBucket = {
  day: string;
  rounds: number;
  wagered: number;
  payout: number;
  ggr: number;
};

const DAY_MS = 86_400_000;

export function dayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export function emptySeries(days: number, end = new Date()): DayBucket[] {
  const buckets: DayBucket[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    buckets.push({
      day: new Date(end.getTime() - i * DAY_MS).toISOString().slice(0, 10),
      rounds: 0,
      wagered: 0,
      payout: 0,
      ggr: 0,
    });
  }
  return buckets;
}

export function buildSeries(
  days: number,
  rows: { created_at: string; total_wagered: unknown; total_payout: unknown }[],
): DayBucket[] {
  const series = emptySeries(days);
  const index = new Map(series.map((b) => [b.day, b]));
  for (const row of rows) {
    const bucket = index.get(dayKey(row.created_at));
    if (!bucket) continue;
    bucket.rounds += 1;
    bucket.wagered += Number(row.total_wagered ?? 0);
    bucket.payout += Number(row.total_payout ?? 0);
    bucket.ggr = bucket.wagered - bucket.payout;
  }
  return series;
}

export function topPlayers(
  bets: { user_id: string; amount: unknown; payout_amount: unknown }[],
  limit = 10,
): { userId: string; bets: number; wagered: number; returned: number; net: number }[] {
  const map = new Map<string, { userId: string; bets: number; wagered: number; returned: number; net: number }>();
  for (const bet of bets) {
    const entry = map.get(bet.user_id) ?? {
      userId: bet.user_id,
      bets: 0,
      wagered: 0,
      returned: 0,
      net: 0,
    };
    entry.bets += 1;
    entry.wagered += Number(bet.amount ?? 0);
    entry.returned += Number(bet.payout_amount ?? 0);
    entry.net = entry.wagered - entry.returned;
    map.set(bet.user_id, entry);
  }
  return [...map.values()].sort((a, b) => b.wagered - a.wagered).slice(0, limit);
}
