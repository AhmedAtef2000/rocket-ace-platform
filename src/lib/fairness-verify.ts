// Phase 17 — browser-side verification of a revealed round. Mirrors
// src/lib/fairness.server.ts exactly so players can reproduce the crash point
// without trusting any server response.

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return toHex(digest);
}

export async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(message),
  );
  return toHex(signature);
}

export async function recomputeCrashPoint(input: {
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  houseEdgeBps: number;
  maxCrashMultiplier: number;
}): Promise<number> {
  const hmac = await hmacSha256Hex(input.serverSeed, `${input.clientSeed}:${input.nonce}`);
  const uniform = parseInt(hmac.slice(0, 13), 16) / 2 ** 52;
  const edge = 1 - input.houseEdgeBps / 10_000;
  if (uniform === 0) return input.maxCrashMultiplier;
  const raw = edge / (1 - uniform);
  const crash = Math.floor(Math.max(1, raw) * 100) / 100;
  return Math.min(crash, input.maxCrashMultiplier);
}

export async function verifyRevealedRound(input: {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  houseEdgeBps: number;
  maxCrashMultiplier: number;
  crashMultiplier: number;
}): Promise<{ hashMatches: boolean; crashMatches: boolean; recomputed: number }> {
  const [hash, recomputed] = await Promise.all([
    sha256Hex(input.serverSeed),
    recomputeCrashPoint(input),
  ]);
  return {
    hashMatches: hash === input.serverSeedHash,
    crashMatches: Math.abs(recomputed - input.crashMultiplier) < 1e-9,
    recomputed,
  };
}
