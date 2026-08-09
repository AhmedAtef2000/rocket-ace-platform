import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { getWallets, topUpDemoWallet } from "@/lib/wallet.functions";
import { Button } from "@/components/ui/button";
import { AccountNav } from "@/components/account/AccountNav";

const title = "Wallet — AstroBet";
const description =
  "Your AstroBet wallet balances and the immutable ledger history behind every movement.";

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WalletPage,
});

function amount(value: string | number | null | undefined, decimals = 2) {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function WalletPage() {
  const queryClient = useQueryClient();
  const fetchWallets = useServerFn(getWallets);
  const topUp = useServerFn(topUpDemoWallet);

  const wallets = useQuery({
    queryKey: ["wallet", "overview"],
    queryFn: async () => fetchWallets({ data: undefined }),
  });

  const topUpMutation = useMutation({
    mutationFn: async () => topUp({ data: undefined }),
    onSuccess: (result) => {
      toast.success(`Added ${amount(result.amount)} demo credits.`);
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      void queryClient.invalidateQueries({ queryKey: ["account"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = wallets.data?.wallets ?? [];
  const entries = wallets.data?.entries ?? [];

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-8">
      <div className="w-full">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Wallet</h1>
        <AccountNav />

        {wallets.isPending ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading your balances…</p>
        ) : (
          <div className="mt-6 space-y-6">
            <section className="rounded-2xl border border-border bg-card/60 p-5">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-sm font-medium text-foreground">Balances</h2>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={topUpMutation.isPending}
                  onClick={() => topUpMutation.mutate()}
                >
                  {topUpMutation.isPending ? "Topping up…" : "Top up demo credits"}
                </Button>
              </div>

              {rows.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No wallets yet.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {rows.map((wallet) => (
                    <li key={wallet.id} className="rounded-md border border-border/60 p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-foreground">
                          {wallet.currency}
                          <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                            {wallet.kind}
                          </span>
                        </span>
                        <span className="font-mono text-foreground">
                          {amount(wallet.available_amount)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span>Reserved in open bets</span>
                        <span className="font-mono">{amount(wallet.locked_amount)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <p className="mt-3 text-xs text-muted-foreground">
                Balances are projections of the ledger. Demo credits have no cash value and can
                never move to or from a real-money wallet.
              </p>
            </section>

            <section className="rounded-2xl border border-border bg-card/60 p-5">
              <h2 className="text-sm font-medium text-foreground">Ledger history</h2>
              {entries.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  No movements yet. Every future deposit, bet and payout appears here.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-border/60 text-sm">
                  {entries.map((entry) => (
                    <li key={entry.id} className="flex items-center justify-between gap-3 py-2">
                      <span className="min-w-0">
                        <span className="block truncate text-foreground">
                          {entry.entry_type.replaceAll("_", " ").toLowerCase()}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {new Date(entry.created_at).toLocaleString()}
                        </span>
                      </span>
                      <span
                        className={
                          entry.direction === "CREDIT"
                            ? "font-mono text-primary"
                            : "font-mono text-muted-foreground"
                        }
                      >
                        {entry.direction === "CREDIT" ? "+" : "−"}
                        {amount(entry.amount)} {entry.currency}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                Ledger records are append-only: corrections are posted as new entries, never edits.
              </p>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
