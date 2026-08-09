import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { AccountNav } from "@/components/account/AccountNav";
import { listVerifiableRounds } from "@/lib/fairness.functions";
import { verifyRevealedRound } from "@/lib/fairness-verify";

const title = "Provably fair verification — Rocket Flight";
const description =
  "Independently recompute every crash multiplier in your browser from the revealed server seed, client seed and nonce.";

export const Route = createFileRoute("/_authenticated/fairness")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FairnessPage,
});

type Row = Awaited<ReturnType<typeof listVerifiableRounds>>[number];
type Check = { hashMatches: boolean; crashMatches: boolean; recomputed: number };

function FairnessPage() {
  const fetchRounds = useServerFn(listVerifiableRounds);
  const rounds = useQuery({
    queryKey: ["fairness", "rounds"],
    queryFn: async () => fetchRounds({ data: undefined }),
    refetchInterval: 20_000,
  });

  const [checks, setChecks] = useState<Record<string, Check>>({});

  useEffect(() => {
    const rows = rounds.data ?? [];
    if (!rows.length) return;
    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        rows.map(async (row: Row) => [row.roundId, await verifyRevealedRound(row)] as const),
      );
      if (!cancelled) setChecks(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [rounds.data]);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-8">
      <h1 className="text-2xl font-semibold tracking-tight">Provably fair verification</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        The server seed is hashed and committed before betting opens, then revealed after the
        round settles. Everything below is recomputed in your browser — nothing here trusts our
        answer.
      </p>
      <AccountNav />

      <section className="mt-8 rounded-xl border border-border p-5 text-sm leading-relaxed text-muted-foreground">
        <p className="font-medium text-foreground">Algorithm</p>
        <p className="mt-2">
          uniform = first 13 hex chars of HMAC-SHA256(serverSeed, "clientSeed:nonce") ÷ 2^52
        </p>
        <p>crash = floor(min(maxMultiplier, (1 − houseEdge) ÷ (1 − uniform)) × 100) ÷ 100</p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium">Revealed rounds</h2>
        {rounds.isLoading ? (
          <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
        ) : (rounds.data ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No settled rounds yet — play a round and it will appear here once the seed is revealed.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {(rounds.data ?? []).map((row: Row) => {
              const check = checks[row.roundId];
              const ok = check?.hashMatches && check?.crashMatches;
              return (
                <li key={row.roundId} className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">Round {row.roundNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        crashed at {row.crashMultiplier.toFixed(2)}× · nonce {row.nonce} ·{" "}
                        {row.algorithmVersion}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        check === undefined
                          ? "border border-border text-muted-foreground"
                          : ok
                            ? "bg-success/15 text-success"
                            : "bg-destructive/15 text-destructive"
                      }`}
                    >
                      {check === undefined
                        ? "Verifying…"
                        : ok
                          ? "Verified in your browser"
                          : "Mismatch"}
                    </span>
                  </div>
                  <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                    <div>
                      <dt className="text-muted-foreground">Server seed hash (committed)</dt>
                      <dd className="break-all font-mono">{row.serverSeedHash}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Server seed (revealed)</dt>
                      <dd className="break-all font-mono">{row.serverSeed}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Client seed</dt>
                      <dd className="break-all font-mono">{row.clientSeed}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Recomputed crash point</dt>
                      <dd className="font-mono">
                        {check ? `${check.recomputed.toFixed(2)}×` : "…"}
                      </dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
