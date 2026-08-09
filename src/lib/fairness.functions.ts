import { createServerFn } from "@tanstack/react-start";

/**
 * Phase 17 — public fairness feed. Only rounds whose server seed has already
 * been revealed are exposed; unrevealed seeds stay in the encrypted table.
 */
export const listVerifiableRounds = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: seeds, error } = await supabaseAdmin
    .from("provably_fair_seeds")
    .select("round_id, server_seed_hash, server_seed_revealed, client_seed, nonce, algorithm_version, revealed_at")
    .not("server_seed_revealed", "is", null)
    .order("revealed_at", { ascending: false })
    .limit(25);
  if (error) throw new Error(error.message);

  const ids = (seeds ?? []).map((s) => s.round_id);
  if (!ids.length) return [];

  const [{ data: rounds }, { data: configs }] = await Promise.all([
    supabaseAdmin
      .from("game_rounds")
      .select("id, round_number, crash_multiplier, config_version, crashed_at")
      .in("id", ids),
    supabaseAdmin.from("game_configurations").select("version, house_edge_bps, max_crash_multiplier"),
  ]);

  const roundById = new Map((rounds ?? []).map((r) => [r.id, r]));
  const configByVersion = new Map((configs ?? []).map((c) => [c.version, c]));

  return (seeds ?? []).flatMap((seed) => {
    const round = roundById.get(seed.round_id);
    if (!round || round.crash_multiplier === null) return [];
    const config = configByVersion.get(round.config_version);
    return [
      {
        roundId: seed.round_id,
        roundNumber: round.round_number,
        crashMultiplier: Number(round.crash_multiplier),
        crashedAt: round.crashed_at,
        serverSeedHash: seed.server_seed_hash,
        serverSeed: seed.server_seed_revealed as string,
        clientSeed: seed.client_seed,
        nonce: Number(seed.nonce),
        algorithmVersion: seed.algorithm_version,
        houseEdgeBps: Number(config?.house_edge_bps ?? 100),
        maxCrashMultiplier: Number(config?.max_crash_multiplier ?? 1000),
      },
    ];
  });
});
