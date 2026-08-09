import { describe, expect, it } from "vitest";
import { crashPointFrom, hashSeed, verifyRound } from "@/lib/fairness.server";
import { recomputeCrashPoint } from "@/lib/fairness-verify";

const SEED = "0f1e2d3c4b5a69788796a5b4c3d2e1f0";
const CLIENT = "rocket-flight";

describe("provably fair", () => {
  it("is deterministic for a given seed triple", () => {
    const a = crashPointFrom(SEED, CLIENT, 7, 100, 10000);
    const b = crashPointFrom(SEED, CLIENT, 7, 100, 10000);
    expect(a).toBe(b);
  });

  it("changes when the nonce changes", () => {
    expect(crashPointFrom(SEED, CLIENT, 1, 100, 10000)).not.toBe(
      crashPointFrom(SEED, CLIENT, 2, 100, 10000),
    );
  });

  it("never returns below 1.00x and respects the cap", () => {
    for (let nonce = 0; nonce < 500; nonce += 1) {
      const crash = crashPointFrom(SEED, CLIENT, nonce, 100, 50);
      expect(crash).toBeGreaterThanOrEqual(1);
      expect(crash).toBeLessThanOrEqual(50);
    }
  });

  it("client verifier reproduces the server crash point bit-for-bit", async () => {
    for (const nonce of [0, 1, 42, 999]) {
      const server = crashPointFrom(SEED, CLIENT, nonce, 100, 10000);
      const client = await recomputeCrashPoint({
        serverSeed: SEED,
        clientSeed: CLIENT,
        nonce,
        houseEdgeBps: 100,
        maxCrashMultiplier: 10000,
      });
      expect(client).toBe(server);
    }
  });

  it("verifyRound rejects a tampered seed hash or crash point", () => {
    const crash = crashPointFrom(SEED, CLIENT, 3, 100, 10000);
    const ok = verifyRound({
      serverSeed: SEED,
      serverSeedHash: hashSeed(SEED),
      clientSeed: CLIENT,
      nonce: 3,
      houseEdgeBps: 100,
      maxCrashMultiplier: 10000,
      crashMultiplier: crash,
    });
    expect(ok.hashMatches && ok.crashMatches).toBe(true);

    const tampered = verifyRound({
      serverSeed: SEED,
      serverSeedHash: hashSeed("other-seed"),
      clientSeed: CLIENT,
      nonce: 3,
      houseEdgeBps: 100,
      maxCrashMultiplier: 10000,
      crashMultiplier: crash + 1,
    });
    expect(tampered.hashMatches).toBe(false);
    expect(tampered.crashMatches).toBe(false);
  });

  it("house edge lowers the expected crash point", () => {
    const zeroEdge = crashPointFrom(SEED, CLIENT, 11, 0, 10000);
    const withEdge = crashPointFrom(SEED, CLIENT, 11, 500, 10000);
    expect(withEdge).toBeLessThanOrEqual(zeroEdge);
  });
});
