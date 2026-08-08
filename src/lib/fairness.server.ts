// Provably fair engine (Phase 7/8). Server seeds are generated here, committed
// as a SHA-256 hash before betting opens and revealed after the round settles.
import { createHash, createHmac, randomBytes } from "node:crypto";

export const ALGORITHM_VERSION = "v1";

export function newServerSeed(): string {
  return randomBytes(32).toString("hex");
}

export function hashSeed(serverSeed: string): string {
  return createHash("sha256").update(serverSeed).digest("hex");
}

/**
 * Crash point = HMAC-SHA256(serverSeed, `${clientSeed}:${nonce}`) mapped to a
 * uniform value, then house-edge adjusted. Deterministic and verifiable.
 */
export function crashPointFrom(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  houseEdgeBps: number,
  maxCrashMultiplier: number,
): number {
  const hmac = createHmac("sha256", serverSeed)
    .update(`${clientSeed}:${nonce}`)
    .digest("hex");

  // 52 bits of entropy -> uniform [0,1)
  const uniform = parseInt(hmac.slice(0, 13), 16) / 2 ** 52;
  const edge = 1 - houseEdgeBps / 10_000;

  if (uniform === 0) return maxCrashMultiplier;
  const raw = edge / (1 - uniform);
  const crash = Math.floor(Math.max(1, raw) * 100) / 100;
  return Math.min(crash, maxCrashMultiplier);
}

export function verifyRound(input: {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  houseEdgeBps: number;
  maxCrashMultiplier: number;
  crashMultiplier: number;
}): { hashMatches: boolean; crashMatches: boolean; recomputed: number } {
  const recomputed = crashPointFrom(
    input.serverSeed,
    input.clientSeed,
    input.nonce,
    input.houseEdgeBps,
    input.maxCrashMultiplier,
  );
  return {
    hashMatches: hashSeed(input.serverSeed) === input.serverSeedHash,
    crashMatches: Math.abs(recomputed - Number(input.crashMultiplier)) < 1e-9,
    recomputed,
  };
}
