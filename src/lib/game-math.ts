// Client-safe crash-game math. The same formulas run on the server, which is
// the only authority; the client uses them purely to animate between polls.

export const MULTIPLIER_DECIMALS = 2;

/** Multiplier as a pure function of elapsed running time. */
export function multiplierAt(elapsedMs: number, growthRate: number): number {
  if (elapsedMs <= 0) return 1;
  return Math.exp(growthRate * elapsedMs);
}

/** Inverse: how long until the curve reaches a multiplier. */
export function msToReach(multiplier: number, growthRate: number): number {
  if (multiplier <= 1) return 0;
  return Math.log(multiplier) / growthRate;
}

export function floorMultiplier(value: number): number {
  return Math.floor(value * 100) / 100;
}

export function formatMultiplier(value: number): string {
  return `${floorMultiplier(value).toFixed(MULTIPLIER_DECIMALS)}x`;
}
