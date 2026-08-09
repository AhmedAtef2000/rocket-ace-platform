/**
 * Registry of per-page translation packs.
 *
 * Each pack file exports a default object keyed by language code. Packs are
 * merged into the base dictionary in `src/lib/i18n.tsx`, so pages can own their
 * copy without every route editing one giant file.
 */
export type Pack = { en: Record<string, string>; ar: Record<string, string>; de: Record<string, string> };

import wallet from "./wallet";
import payments from "./payments";
import game from "./game";
import account from "./account";
import support from "./support";
import fairness from "./fairness";
import compliance from "./compliance";
import admin from "./admin";
import user360 from "./user360";
import misc from "./misc";

export const packs: Pack[] = [
  wallet,
  payments,
  game,
  account,
  support,
  fairness,
  compliance,
  admin,
  user360,
  misc,
];
