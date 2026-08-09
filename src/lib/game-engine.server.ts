// Server-authoritative crash round loop (Phase 7).
// Every transition is a conditional UPDATE, so concurrent ticks are safe:
// only one caller can win a given state change, the rest are no-ops.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { ALGORITHM_VERSION, crashPointFrom, hashSeed, newServerSeed } from "@/lib/fairness.server";
import { msToReach } from "@/lib/game-math";

type Admin = SupabaseClient<Database>;

export const POST_ROUND_PAUSE_MS = 5_000;
/** Hard cap on flight time: a round never runs longer than 10 seconds. */
export const MAX_FLIGHT_MS = 10_000;

export type GameConfig = {
  version: number;
  min_bet: number;
  max_bet: number;
  max_payout: number;
  betting_duration_ms: number;
  crash_growth_rate: number;
  house_edge_bps: number;
  max_crash_multiplier: number;
};

export type EngineRound = {
  id: string;
  round_number: string;
  status: Database["public"]["Enums"]["round_status"];
  betting_open_at: string | null;
  betting_closed_at: string | null;
  started_at: string | null;
  crashed_at: string | null;
  settled_at: string | null;
  crash_multiplier: number | null;
  total_wagered: number | null;
  total_payout: number | null;
  config_version: number;
};

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

export async function loadConfig(admin: Admin): Promise<GameConfig> {
  const { data, error } = await admin
    .from("game_configurations")
    .select(
      "version, min_bet, max_bet, max_payout, betting_duration_ms, crash_growth_rate, house_edge_bps, max_crash_multiplier",
    )
    .eq("active", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No active game configuration.");
  return {
    version: data.version,
    min_bet: num(data.min_bet),
    max_bet: num(data.max_bet),
    max_payout: num(data.max_payout),
    betting_duration_ms: data.betting_duration_ms,
    crash_growth_rate: num(data.crash_growth_rate),
    house_edge_bps: data.house_edge_bps,
    max_crash_multiplier: num(data.max_crash_multiplier),
  };
}

async function currentRound(admin: Admin): Promise<EngineRound | null> {
  const { data, error } = await admin
    .from("game_rounds")
    .select(
      "id, round_number, status, betting_open_at, betting_closed_at, started_at, crashed_at, settled_at, crash_multiplier, total_wagered, total_payout, config_version",
    )
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as EngineRound | null) ?? null;
}

async function createRound(admin: Admin, cfg: GameConfig): Promise<EngineRound | null> {
  // Time-bucketed round number: concurrent creators collide on the unique
  // index and only one round is ever created per bucket.
  const bucket = Math.floor(Date.now() / 1000);
  const roundNumber = `RF-${bucket}`;

  const { data: round, error } = await admin
    .from("game_rounds")
    .insert({ round_number: roundNumber, status: "CREATED", config_version: cfg.version })
    .select(
      "id, round_number, status, betting_open_at, betting_closed_at, started_at, crashed_at, settled_at, crash_multiplier, total_wagered, total_payout, config_version",
    )
    .maybeSingle();
  if (error || !round) return null; // lost the race — another tick created it

  const serverSeed = newServerSeed();
  const { count } = await admin
    .from("game_rounds")
    .select("id", { count: "exact", head: true });
  const nonce = count ?? 1;
  const clientSeed = hashSeed(roundNumber).slice(0, 32);

  await admin.from("provably_fair_secrets").insert({
    round_id: round.id,
    server_seed_encrypted: serverSeed,
  });
  await admin.from("provably_fair_seeds").insert({
    round_id: round.id,
    server_seed_hash: hashSeed(serverSeed),
    client_seed: clientSeed,
    nonce,
    algorithm_version: ALGORITHM_VERSION,
  });

  const { data: opened } = await admin
    .from("game_rounds")
    .update({ status: "BETTING", betting_open_at: new Date().toISOString() })
    .eq("id", round.id)
    .eq("status", "CREATED")
    .select(
      "id, round_number, status, betting_open_at, betting_closed_at, started_at, crashed_at, settled_at, crash_multiplier, total_wagered, total_payout, config_version",
    )
    .maybeSingle();

  return (opened as EngineRound | null) ?? (round as EngineRound);
}

async function committedCrash(admin: Admin, roundId: string, cfg: GameConfig): Promise<number> {
  const [{ data: secret }, { data: seed }] = await Promise.all([
    admin
      .from("provably_fair_secrets")
      .select("server_seed_encrypted")
      .eq("round_id", roundId)
      .maybeSingle(),
    admin
      .from("provably_fair_seeds")
      .select("client_seed, nonce")
      .eq("round_id", roundId)
      .maybeSingle(),
  ]);
  if (!secret || !seed) throw new Error("Round fairness data missing.");
  const raw = crashPointFrom(
    secret.server_seed_encrypted,
    seed.client_seed,
    Number(seed.nonce),
    cfg.house_edge_bps,
    cfg.max_crash_multiplier,
  );
  // Deterministic, published cap: the crash point can never exceed the
  // multiplier reachable within MAX_FLIGHT_MS, so every flight ends by 10s.
  const timeCap = Math.floor(Math.exp(cfg.crash_growth_rate * MAX_FLIGHT_MS) * 100) / 100;
  return Math.min(raw, timeCap);
}

/**
 * Advances the round loop to the state the clock says it should be in and
 * returns the authoritative round. Safe to call from every request.
 */
export async function tickEngine(
  admin: Admin,
): Promise<{ config: GameConfig; round: EngineRound | null; serverTime: string }> {
  const cfg = await loadConfig(admin);
  let round = await currentRound(admin);
  const now = () => Date.now();

  for (let step = 0; step < 4; step += 1) {
    if (!round || round.status === "SETTLED" || round.status === "CANCELLED") {
      const terminalAt = round?.settled_at ? new Date(round.settled_at).getTime() : 0;
      if (round && now() - terminalAt < POST_ROUND_PAUSE_MS) break;
      const created = await createRound(admin, cfg);
      round = created ?? (await currentRound(admin));
      if (!round || round.status !== "BETTING") break;
      continue;
    }

    if (round.status === "CREATED") {
      const { data } = await admin
        .from("game_rounds")
        .update({ status: "BETTING", betting_open_at: new Date().toISOString() })
        .eq("id", round.id)
        .eq("status", "CREATED")
        .select("id")
        .maybeSingle();
      void data;
      round = await currentRound(admin);
      continue;
    }

    if (round.status === "BETTING") {
      const openedAt = round.betting_open_at ? new Date(round.betting_open_at).getTime() : now();
      if (now() - openedAt < cfg.betting_duration_ms) break;
      const startedAt = new Date().toISOString();
      await admin
        .from("game_rounds")
        .update({ status: "RUNNING", betting_closed_at: startedAt, started_at: startedAt })
        .eq("id", round.id)
        .eq("status", "BETTING");
      round = await currentRound(admin);
      continue;
    }

    if (round.status === "RUNNING") {
      const crash = await committedCrash(admin, round.id, cfg);
      const startedAt = round.started_at ? new Date(round.started_at).getTime() : now();
      const runFor = Math.min(msToReach(crash, cfg.crash_growth_rate), MAX_FLIGHT_MS);
      if (now() - startedAt < runFor) break;
      await admin
        .from("game_rounds")
        .update({
          status: "CRASHED",
          crashed_at: new Date().toISOString(),
          crash_multiplier: crash,
        })
        .eq("id", round.id)
        .eq("status", "RUNNING");
      round = await currentRound(admin);
      continue;
    }

    if (round.status === "CRASHED") {
      // Reveal the seed, then settle every open bet atomically in the DB.
      const { data: secret } = await admin
        .from("provably_fair_secrets")
        .select("server_seed_encrypted")
        .eq("round_id", round.id)
        .maybeSingle();
      if (secret) {
        await admin
          .from("provably_fair_seeds")
          .update({
            server_seed_revealed: secret.server_seed_encrypted,
            revealed_at: new Date().toISOString(),
          })
          .eq("round_id", round.id)
          .is("server_seed_revealed", null);
      }
      const { error } = await admin.rpc("game_settle_round", { _round_id: round.id });
      if (error && !/ROUND_NOT_CRASHED|already/i.test(error.message)) throw new Error(error.message);
      round = await currentRound(admin);
      continue;
    }

    break; // SETTLING is transient and owned by the settle function
  }

  return { config: cfg, round, serverTime: new Date().toISOString() };
}

/** Live multiplier the server would show right now for a running round. */
export function liveMultiplier(round: EngineRound, cfg: GameConfig): number {
  if (round.status !== "RUNNING" || !round.started_at) return 1;
  const elapsed = Date.now() - new Date(round.started_at).getTime();
  return Math.exp(cfg.crash_growth_rate * Math.max(0, elapsed));
}
