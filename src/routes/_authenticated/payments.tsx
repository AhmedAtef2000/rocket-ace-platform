import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import {
  cancelWithdrawal,
  createDeposit,
  getPaymentsOverview,
  requestWithdrawal,
  simulateDepositCredit,
} from "@/lib/payments.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AccountNav } from "@/components/account/AccountNav";

const title = "Deposits & withdrawals — Rocket Flight";
const description =
  "Fund your Rocket Flight account with crypto and request payouts, with compliance and responsible-gambling checks on every movement.";

export const Route = createFileRoute("/_authenticated/payments")({
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
  component: PaymentsPage,
});

function num(value: string | number | null | undefined, decimals = 2) {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

function PaymentsPage() {
  const queryClient = useQueryClient();
  const fetchOverview = useServerFn(getPaymentsOverview);
  const newDeposit = useServerFn(createDeposit);
  const settle = useServerFn(simulateDepositCredit);
  const withdraw = useServerFn(requestWithdrawal);
  const cancel = useServerFn(cancelWithdrawal);

  const [pair, setPair] = useState("");
  const [wdAmount, setWdAmount] = useState("");
  const [wdAddress, setWdAddress] = useState("");
  const [settleAmount, setSettleAmount] = useState<Record<string, string>>({});

  const overview = useQuery({
    queryKey: ["payments", "overview"],
    queryFn: async () => fetchOverview({ data: undefined }),
  });

  const networks = overview.data?.networks ?? [];
  const selected = useMemo(() => {
    const key = pair || (networks[0] ? `${networks[0].currency}:${networks[0].network}` : "");
    return networks.find((n) => `${n.currency}:${n.network}` === key) ?? null;
  }, [pair, networks]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["payments"] });
    void queryClient.invalidateQueries({ queryKey: ["wallet"] });
  };

  const depositMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Choose a network.");
      return newDeposit({ data: { currency: selected.currency, network: selected.network } });
    },
    onSuccess: () => {
      toast.success("Deposit address issued.");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const settleMutation = useMutation({
    mutationFn: async (vars: { depositId: string; amount: number }) => settle({ data: vars }),
    onSuccess: (result) => {
      toast.success(result.credited ? "Deposit credited." : "Deposit already settled.");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Choose a network.");
      return withdraw({
        data: {
          currency: selected.currency,
          network: selected.network,
          amount: Number(wdAmount),
          destinationAddress: wdAddress,
        },
      });
    },
    onSuccess: () => {
      toast.success("Withdrawal requested and funds reserved.");
      setWdAmount("");
      setWdAddress("");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => cancel({ data: { id } }),
    onSuccess: () => {
      toast.success("Withdrawal cancelled and funds released.");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const eligible = overview.data?.realMoneyEligible ?? false;
  const blockedGate = overview.data?.gates?.find((g) => !g.passed);

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <h1 className="text-2xl font-semibold text-foreground">Deposits &amp; withdrawals</h1>
        <AccountNav />

        {overview.isPending ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading payment options…</p>
        ) : (
          <div className="mt-6 space-y-6">
            {!eligible && (
              <section className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
                <h2 className="text-sm font-medium text-foreground">Real-money access locked</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {blockedGate
                    ? `${blockedGate.label}: ${blockedGate.detail}`
                    : "Complete verification to unlock deposits and withdrawals."}
                </p>
              </section>
            )}

            <section className="rounded-lg border border-border p-4">
              <h2 className="text-sm font-medium text-foreground">Real-money balances</h2>
              {(overview.data?.wallets ?? []).length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  No real-money wallet yet — one is created with your first deposit.
                </p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm">
                  {(overview.data?.wallets ?? []).map((w) => (
                    <li key={w.id} className="flex items-center justify-between">
                      <span className="text-foreground">{w.currency}</span>
                      <span className="font-mono text-foreground">
                        {num(w.available_amount, 8)}
                        <span className="ml-2 text-xs text-muted-foreground">
                          reserved {num(w.locked_amount, 8)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-lg border border-border p-4">
              <h2 className="text-sm font-medium text-foreground">Choose asset &amp; network</h2>
              <div className="mt-3 grid gap-2">
                <Label htmlFor="network">Asset / network</Label>
                <select
                  id="network"
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                  value={selected ? `${selected.currency}:${selected.network}` : ""}
                  onChange={(event) => setPair(event.target.value)}
                >
                  {networks.map((n) => (
                    <option key={`${n.currency}:${n.network}`} value={`${n.currency}:${n.network}`}>
                      {n.currency} · {n.network}
                    </option>
                  ))}
                </select>
                {selected && (
                  <p className="text-xs text-muted-foreground">
                    Min deposit {num(selected.minDeposit, 8)} {selected.currency} ·{" "}
                    {selected.requiredConfirmations} confirmations · min withdrawal{" "}
                    {num(selected.minWithdrawal, 8)} {selected.currency}
                  </p>
                )}
              </div>
              <Button
                className="mt-4"
                size="sm"
                disabled={!eligible || depositMutation.isPending}
                onClick={() => depositMutation.mutate()}
              >
                {depositMutation.isPending ? "Issuing…" : "Get deposit address"}
              </Button>
            </section>

            <section className="rounded-lg border border-border p-4">
              <h2 className="text-sm font-medium text-foreground">Deposits</h2>
              {(overview.data?.deposits ?? []).length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No deposits yet.</p>
              ) : (
                <ul className="mt-3 space-y-3 text-sm">
                  {(overview.data?.deposits ?? []).map((d) => (
                    <li key={d.id} className="rounded-md border border-border/60 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-foreground">
                          {d.currency} · {d.network}
                        </span>
                        <span className="text-xs uppercase text-muted-foreground">{d.status}</span>
                      </div>
                      <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                        {d.deposit_address}
                      </p>
                      {d.status === "CONFIRMED" ? (
                        <p className="mt-2 text-xs text-primary">
                          Credited {num(d.confirmed_amount, 8)} {d.currency}
                        </p>
                      ) : (
                        <div className="mt-2 flex gap-2">
                          <Input
                            aria-label={`Simulated amount for ${d.currency}`}
                            inputMode="decimal"
                            placeholder="Amount received"
                            value={settleAmount[d.id] ?? ""}
                            onChange={(event) =>
                              setSettleAmount((prev) => ({ ...prev, [d.id]: event.target.value }))
                            }
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={settleMutation.isPending}
                            onClick={() =>
                              settleMutation.mutate({
                                depositId: d.id,
                                amount: Number(settleAmount[d.id]),
                              })
                            }
                          >
                            Simulate
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                No chain is connected yet: “Simulate” runs the same signed-webhook credit path a
                real provider would trigger.
              </p>
            </section>

            <section className="rounded-lg border border-border p-4">
              <h2 className="text-sm font-medium text-foreground">Request a withdrawal</h2>
              <div className="mt-3 grid gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="wd-amount">Amount</Label>
                  <Input
                    id="wd-amount"
                    inputMode="decimal"
                    value={wdAmount}
                    onChange={(event) => setWdAmount(event.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="wd-address">Destination address</Label>
                  <Input
                    id="wd-address"
                    value={wdAddress}
                    onChange={(event) => setWdAddress(event.target.value)}
                    placeholder="Your wallet address"
                  />
                </div>
                <Button
                  size="sm"
                  disabled={!eligible || withdrawMutation.isPending}
                  onClick={() => withdrawMutation.mutate()}
                >
                  {withdrawMutation.isPending ? "Submitting…" : "Request withdrawal"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  A 1% network fee applies. Funds are reserved on request; large payouts go to risk
                  review and need two approvers before they are paid out.
                </p>
              </div>
            </section>

            <section className="rounded-lg border border-border p-4">
              <h2 className="text-sm font-medium text-foreground">Withdrawal history</h2>
              {(overview.data?.withdrawals ?? []).length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No withdrawals yet.</p>
              ) : (
                <ul className="mt-3 space-y-3 text-sm">
                  {(overview.data?.withdrawals ?? []).map((w) => (
                    <li key={w.id} className="rounded-md border border-border/60 p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-foreground">
                          {num(w.amount, 8)} {w.currency}
                        </span>
                        <span className="text-xs uppercase text-muted-foreground">{w.status}</span>
                      </div>
                      <p className="mt-1 break-all text-xs text-muted-foreground">
                        {w.network} · fee {num(w.fee_amount, 8)} · approvals {w.approvals_count}/
                        {w.approvals_required}
                      </p>
                      <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                        {w.destination_address}
                      </p>
                      {["REQUESTED", "RISK_REVIEW"].includes(w.status) && (
                        <Button
                          className="mt-2"
                          size="sm"
                          variant="outline"
                          disabled={cancelMutation.isPending}
                          onClick={() => cancelMutation.mutate(w.id)}
                        >
                          Cancel
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}