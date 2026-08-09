import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { AccountNav } from "@/components/account/AccountNav";
import { listVerifiableRounds } from "@/lib/fairness.functions";
import { verifyRevealedRound } from "@/lib/fairness-verify";
import { useI18n } from "@/lib/i18n";

const title = "Provably fair verification — AstroBet";
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
  const { t } = useI18n();
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
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{t("fair.heading")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("fair.subtitle")}
      </p>
      <AccountNav />

      <section className="mt-8">
        <h2 className="text-lg font-medium">{t("fair.revealed.heading")}</h2>
        {rounds.isLoading ? (
          <p className="mt-3 text-sm text-muted-foreground">{t("fair.loading")}</p>
        ) : (rounds.data ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {t("fair.empty")}
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-card/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">{t("fair.table.roundId")}</th>
                  <th className="px-4 py-3 text-right font-medium">{t("fair.table.crash")}</th>
                  <th className="px-4 py-3 text-right font-medium">{t("fair.table.totalBets")}</th>
                  <th className="px-4 py-3 text-right font-medium">{t("fair.table.netResult")}</th>
                  <th className="px-4 py-3 text-right font-medium">{t("fair.table.check")}</th>
                </tr>
              </thead>
              <tbody>
                {(rounds.data ?? []).map((row: Row) => {
                  const check = checks[row.roundId];
                  const ok = check?.hashMatches && check?.crashMatches;
                  const net = row.netPlayerResult;
                  return (
                    <tr key={row.roundId} className="border-t border-border/60">
                      <td className="px-4 py-3 font-mono text-xs">{row.roundNumber}</td>
                      <td className="px-4 py-3 text-right font-mono">
                        {row.crashMultiplier.toFixed(2)}×
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {money(row.totalWagered)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-mono ${
                          net > 0 ? "text-success" : net < 0 ? "text-destructive" : ""
                        }`}
                      >
                        {net > 0 ? "+" : ""}
                        {money(net)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            check === undefined
                              ? "border border-border text-muted-foreground"
                              : ok
                                ? "bg-success/15 text-success"
                                : "bg-destructive/15 text-destructive"
                          }`}
                        >
                          {check === undefined ? t("fair.status.checking") : ok ? t("fair.status.verified") : t("fair.status.mismatch")}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          {t("fair.footnote")}
        </p>
      </section>
    </main>
  );
}

function money(value: number) {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
