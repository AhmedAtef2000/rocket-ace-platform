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
  submitManualDeposit,
} from "@/lib/payments.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AccountNav } from "@/components/account/AccountNav";
import { useI18n } from "@/lib/i18n";

const title = "Deposits & withdrawals — AstroBet";
const description =
  "Fund your AstroBet account with crypto and request payouts, with compliance and responsible-gambling checks on every movement.";

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
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const fetchOverview = useServerFn(getPaymentsOverview);
  const newDeposit = useServerFn(createDeposit);
  const settle = useServerFn(simulateDepositCredit);
  const withdraw = useServerFn(requestWithdrawal);
  const cancel = useServerFn(cancelWithdrawal);
  const manualSubmit = useServerFn(submitManualDeposit);

  const [pair, setPair] = useState("");
  const [channel, setChannel] = useState<"CRYPTO" | "LOCAL">("CRYPTO");
  const [depAmount, setDepAmount] = useState("100");
  const [wdAmount, setWdAmount] = useState("");
  const [wdAddress, setWdAddress] = useState("");
  const [settleAmount, setSettleAmount] = useState<Record<string, string>>({});
  const [manualMethod, setManualMethod] = useState("VODAFONE_CASH");
  const [manualAmount, setManualAmount] = useState("");
  const [manualSender, setManualSender] = useState("");
  const [manualReference, setManualReference] = useState("");
  const [manualFile, setManualFile] = useState<File | null>(null);

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
      if (!selected) throw new Error(t("pay.chooseNetworkError"));
      return newDeposit({ data: { currency: selected.currency, network: selected.network } });
    },
    onSuccess: () => {
      toast.success(t("pay.depositIssued"));
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const settleMutation = useMutation({
    mutationFn: async (vars: { depositId: string; amount: number }) => settle({ data: vars }),
    onSuccess: (result) => {
      toast.success(result.credited ? t("pay.depositCredited") : t("pay.depositAlreadySettled"));
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error(t("pay.chooseNetworkError"));
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
      toast.success(t("pay.withdrawalRequested"));
      setWdAmount("");
      setWdAddress("");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => cancel({ data: { id } }),
    onSuccess: () => {
      toast.success(t("pay.withdrawalCancelled"));
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const manualMutation = useMutation({
    mutationFn: async () => {
      if (!manualFile) throw new Error(t("pay.attachScreenshotError"));
      const buffer = await manualFile.arrayBuffer();
      let binary = "";
      const view = new Uint8Array(buffer);
      for (let i = 0; i < view.length; i += 1) binary += String.fromCharCode(view[i]!);
      return manualSubmit({
        data: {
          method: manualMethod,
          currency: overview.data?.wallets?.[0]?.currency ?? "USDT",
          amount: Number(manualAmount),
          senderNumber: manualSender,
          reference: manualReference,
          fileName: manualFile.name,
          mimeType: manualFile.type,
          contentBase64: btoa(binary),
        },
      });
    },
    onSuccess: () => {
      toast.success(t("pay.depositSubmittedForReview"));
      setManualAmount("");
      setManualSender("");
      setManualReference("");
      setManualFile(null);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const eligible = overview.data?.realMoneyEligible ?? false;
  const blockedGate = overview.data?.gates?.find((g) => !g.passed && !g.internal);
  const playthrough = overview.data?.playthrough;
  const minDeposit = overview.data?.minDeposit ?? 5;
  const noticeHours = overview.data?.withdrawalNoticeHours ?? 24;
  const manualMethods = overview.data?.manualMethods ?? [];
  const selectedManual = manualMethods.find((m) => m.id === manualMethod);

  const deposits = overview.data?.deposits ?? [];
  const withdrawals = overview.data?.withdrawals ?? [];
  const manualDeposits = overview.data?.manualDeposits ?? [];
  const latestPending = deposits.find((d) => d.status !== "CONFIRMED");
  const totalDeposited = deposits.reduce((sum, d) => sum + Number(d.confirmed_amount ?? 0), 0);
  const totalWithdrawn = withdrawals
    .filter((w) => !["CANCELLED", "FAILED", "REJECTED"].includes(w.status))
    .reduce((sum, w) => sum + Number(w.amount ?? 0), 0);
  const wdNet = Math.max(Number(wdAmount || 0) - Number(wdAmount || 0) * 0.01, 0);
  const availableBalance = Number(overview.data?.wallets?.[0]?.available_amount ?? 0);
  const walletCurrency = overview.data?.wallets?.[0]?.currency ?? selected?.currency ?? "USD";

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-8">
      <div className="w-full">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight">{t("pay.title")}</h1>
            <AccountNav />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border bg-card/60 px-5 py-3">
              <p className="text-xs text-muted-foreground">{t("pay.totalDeposited")}</p>
              <p className="mt-1 font-mono text-xl font-semibold text-primary" dir="ltr">
                {num(totalDeposited, 8)}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card/60 px-5 py-3">
              <p className="text-xs text-muted-foreground">{t("pay.totalWithdrawn")}</p>
              <p className="mt-1 font-mono text-xl font-semibold text-foreground" dir="ltr">
                {num(totalWithdrawn, 8)}
              </p>
            </div>
          </div>
        </div>

        {overview.isPending ? (
          <p className="mt-6 text-sm text-muted-foreground">{t("pay.loading")}</p>
        ) : (
          <div className="mt-6 space-y-6">
            {!eligible && (
              <section className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
                <h2 className="text-sm font-medium text-foreground">{t("pay.withdrawalsLocked")}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {blockedGate
                    ? t("pay.gateDetail", { label: blockedGate.label, detail: blockedGate.detail })
                    : t("pay.gateFallback")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("pay.verificationNote")}
                </p>
                <a
                  href="/compliance"
                  className="mt-3 inline-block rounded-md border border-primary/50 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                >
                  {t("pay.uploadDocuments")}
                </a>
              </section>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
              {/* ---------------- Deposit ---------------- */}
              <section className="rounded-2xl border border-border bg-card/60 p-5">
                <h2 className="font-display text-xl font-bold text-foreground">{t("pay.deposit")}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("pay.depositSubtitle")}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <MethodChip
                    active={channel === "CRYPTO"}
                    onClick={() => setChannel("CRYPTO")}
                    label={t("pay.methodCrypto")}
                  />
                  {manualMethods.map((m) => (
                    <MethodChip
                      key={m.id}
                      active={channel === "LOCAL" && manualMethod === m.id}
                      onClick={() => {
                        setChannel("LOCAL");
                        setManualMethod(m.id);
                      }}
                      label={m.label}
                    />
                  ))}
                </div>

                {channel === "CRYPTO" ? (
                  <div className="mt-5 grid gap-5 xl:grid-cols-2">
                    <div className="grid gap-3">
                      <div className="grid gap-2">
                        <Label htmlFor="network">{t("pay.network")}</Label>
                        <select
                          id="network"
                          className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                          value={selected ? `${selected.currency}:${selected.network}` : ""}
                          onChange={(event) => setPair(event.target.value)}
                        >
                          {networks.map((n) => (
                            <option
                              key={`${n.currency}:${n.network}`}
                              value={`${n.currency}:${n.network}`}
                            >
                              {n.currency} · {n.network}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="dep-amount">{t("pay.depositAmount")}</Label>
                        <div className="relative">
                          <Input
                            id="dep-amount"
                            inputMode="decimal"
                            value={depAmount}
                            onChange={(event) => setDepAmount(event.target.value)}
                          />
                          <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs text-muted-foreground">
                            {selected?.currency ?? ""}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {[50, 100, 250, 500, 1000].map((v) => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => setDepAmount(String(v))}
                              className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                                depAmount === String(v)
                                  ? "border-primary/60 bg-primary/10 text-primary"
                                  : "border-border text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground">{t("pay.youWillReceive")}</p>
                        <p className="font-mono text-2xl font-semibold text-primary" dir="ltr">
                          {num(Number(depAmount || 0), 8)} {selected?.currency ?? ""}
                        </p>
                      </div>

                      <Button
                        disabled={!eligible || depositMutation.isPending}
                        onClick={() => depositMutation.mutate()}
                      >
                        {depositMutation.isPending ? t("pay.issuing") : t("pay.createDeposit")}
                      </Button>
                    </div>

                    <div className="rounded-xl border border-border/60 bg-background/40 p-4">
                      <h3 className="text-sm font-medium text-foreground">
                        {t("pay.sendCurrencyTo", { currency: selected?.currency ?? t("pay.deposit") })}
                      </h3>
                      <p className="mt-2 break-all rounded-lg border border-border/60 bg-card/60 p-2 font-mono text-xs text-foreground">
                        {latestPending?.deposit_address ??
                          t("pay.createDepositToGenerate")}
                      </p>
                      <dl className="mt-3 space-y-1.5 text-xs">
                        <div className="flex justify-between gap-2">
                          <dt className="text-muted-foreground">{t("pay.minimumDeposit")}</dt>
                          <dd className="font-mono text-foreground" dir="ltr">
                            {num(selected?.minDeposit ?? minDeposit, 8)} {selected?.currency ?? ""}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-muted-foreground">{t("pay.confirmationsRequired")}</dt>
                          <dd className="font-mono text-foreground" dir="ltr">
                            {selected?.requiredConfirmations ?? "—"}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-muted-foreground">{t("pay.currentConfirmations")}</dt>
                          <dd className="font-mono text-primary" dir="ltr">
                            {latestPending?.confirmations ?? 0} /{" "}
                            {latestPending?.required_confirmations ??
                              selected?.requiredConfirmations ??
                              0}
                          </dd>
                        </div>
                      </dl>
                      <p className="mt-3 rounded-lg border border-border/60 bg-card/40 p-3 text-xs text-muted-foreground">
                        {t("pay.sendOnlyNote", {
                          currency: selected?.currency ?? t("pay.theSelectedAsset"),
                          network: selected?.network ?? t("pay.theSelectedNetwork"),
                        })}
                      </p>
                      {latestPending && (
                        <div className="mt-3 flex gap-2">
                          <Input
                            aria-label={t("pay.amountReceived")}
                            inputMode="decimal"
                            placeholder={t("pay.amountReceived")}
                            value={settleAmount[latestPending.id] ?? ""}
                            onChange={(event) =>
                              setSettleAmount((prev) => ({
                                ...prev,
                                [latestPending.id]: event.target.value,
                              }))
                            }
                          />
                          <Button
                            variant="outline"
                            disabled={settleMutation.isPending}
                            onClick={() =>
                              settleMutation.mutate({
                                depositId: latestPending.id,
                                amount: Number(settleAmount[latestPending.id]),
                              })
                            }
                          >
                            {t("pay.simulate")}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-2 sm:col-span-2">
                      <p className="rounded-lg border border-border/60 bg-background/40 p-3 text-xs text-muted-foreground">
                        {t("pay.sendFromWalletNumber")}{" "}
                        <span className="font-mono text-foreground">
                          {selectedManual?.payTo ?? "—"}
                        </span>
                        {t("pay.uploadReceiptNote", { amount: num(minDeposit) })}
                      </p>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="manual-amount">{t("pay.amountSent")}</Label>
                      <Input
                        id="manual-amount"
                        inputMode="decimal"
                        placeholder={`${minDeposit}.00`}
                        value={manualAmount}
                        onChange={(event) => setManualAmount(event.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="manual-sender">{t("pay.yourWalletNumber")}</Label>
                      <Input
                        id="manual-sender"
                        inputMode="tel"
                        placeholder={t("pay.walletNumberPlaceholder")}
                        value={manualSender}
                        onChange={(event) => setManualSender(event.target.value)}
                      />
                    </div>
                    <div className="grid gap-2 sm:col-span-2">
                      <Label htmlFor="manual-reference">{t("pay.transactionReference")}</Label>
                      <Input
                        id="manual-reference"
                        value={manualReference}
                        onChange={(event) => setManualReference(event.target.value)}
                      />
                    </div>
                    <div className="grid gap-2 sm:col-span-2">
                      <Label htmlFor="manual-proof">
                        {t("pay.paymentProof")}
                      </Label>
                      <input
                        id="manual-proof"
                        type="file"
                        accept="image/png,image/jpeg,image/webp,application/pdf"
                        className="text-sm text-muted-foreground file:me-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-xs file:text-foreground"
                        onChange={(event) => setManualFile(event.target.files?.[0] ?? null)}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Button
                        className="w-full"
                        disabled={!eligible || manualMutation.isPending}
                        onClick={() => manualMutation.mutate()}
                      >
                        {manualMutation.isPending ? t("pay.submitting") : t("pay.submitDepositForReview")}
                      </Button>
                    </div>
                    {manualDeposits.length > 0 && (
                      <ul className="mt-1 space-y-2 text-sm sm:col-span-2">
                        {manualDeposits.map((m) => (
                          <li
                            key={m.id}
                            className="flex items-center justify-between rounded-xl border border-border/60 bg-card/40 px-3 py-2"
                          >
                            <span className="text-foreground">
                              {num(m.amount)} {m.currency} ·{" "}
                              {m.method.replace(/_/g, " ").toLowerCase()}
                            </span>
                            <StatusBadge status={m.status} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </section>

              {/* ---------------- Withdraw ---------------- */}
              <section className="rounded-2xl border border-border bg-card/60 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-xl font-bold text-foreground">{t("pay.withdraw")}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("pay.withdrawSubtitle")}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("pay.available")}:{" "}
                    <span className="font-mono text-primary" dir="ltr">
                      {num(availableBalance, 8)} {walletCurrency}
                    </span>
                  </p>
                </div>

                {playthrough && !playthrough.cleared && (
                  <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-muted-foreground">
                    {t("pay.amlNote", {
                      wagered: num(playthrough.wagered),
                      required: num(playthrough.required),
                      remaining: num(playthrough.remaining),
                    })}
                  </p>
                )}

                <div className="mt-4 grid gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="wd-amount">{t("pay.withdrawAmount")}</Label>
                    <Input
                      id="wd-amount"
                      inputMode="decimal"
                      value={wdAmount}
                      onChange={(event) => setWdAmount(event.target.value)}
                      placeholder="0.00"
                    />
                    <div className="flex flex-wrap gap-2">
                      {[50, 100, 250].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setWdAmount(String(v))}
                          className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {v}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setWdAmount(String(availableBalance))}
                        className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {t("pay.max")}
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="wd-address">{t("pay.walletAddress")}</Label>
                    <Input
                      id="wd-address"
                      value={wdAddress}
                      onChange={(event) => setWdAddress(event.target.value)}
                      placeholder={t("pay.walletAddressPlaceholder")}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2 rounded-xl border border-border/60 bg-background/40 p-3 text-center">
                    <div>
                      <p className="text-[11px] text-muted-foreground">{t("pay.youSend")}</p>
                      <p className="font-mono text-sm text-foreground" dir="ltr">
                        {num(Number(wdAmount || 0), 8)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">{t("pay.networkFee")}</p>
                      <p className="font-mono text-sm text-foreground" dir="ltr">
                        {num(Number(wdAmount || 0) * 0.01, 8)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">{t("pay.youWillGet")}</p>
                      <p className="font-mono text-sm text-primary" dir="ltr">
                        {num(wdNet, 8)}
                      </p>
                    </div>
                  </div>

                  <Button
                    disabled={
                      !eligible || withdrawMutation.isPending || playthrough?.cleared === false
                    }
                    onClick={() => withdrawMutation.mutate()}
                  >
                    {withdrawMutation.isPending ? t("pay.submitting") : t("pay.continue")}
                  </Button>

                  <p className="rounded-xl border border-border/60 bg-background/40 p-3 text-xs text-muted-foreground">
                    {t("pay.withdrawalNote", { hours: noticeHours })}
                  </p>
                </div>
              </section>
            </div>

            {/* ---------------- History ---------------- */}
            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-2xl border border-border bg-card/60 p-5">
                <h2 className="text-sm font-medium text-foreground">{t("pay.recentDeposits")}</h2>
                {deposits.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">{t("pay.noDeposits")}</p>
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-start text-xs uppercase text-muted-foreground">
                          <th className="py-2 text-start font-medium">{t("pay.colCoin")}</th>
                          <th className="py-2 text-start font-medium">{t("pay.colNetwork")}</th>
                          <th className="py-2 text-start font-medium">{t("pay.colAmount")}</th>
                          <th className="py-2 text-start font-medium">{t("pay.colConf")}</th>
                          <th className="py-2 text-start font-medium">{t("pay.colStatus")}</th>
                          <th className="py-2 text-start font-medium">{t("pay.colDate")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {deposits.map((d) => (
                          <tr key={d.id}>
                            <td className="py-2 text-foreground">{d.currency}</td>
                            <td className="py-2 text-muted-foreground">{d.network}</td>
                            <td className="py-2 font-mono text-foreground" dir="ltr">
                              {num(d.confirmed_amount ?? d.requested_amount, 8)}
                            </td>
                            <td className="py-2 font-mono text-muted-foreground" dir="ltr">
                              {d.confirmations ?? 0}/{d.required_confirmations}
                            </td>
                            <td className="py-2">
                              <StatusBadge status={d.status} />
                            </td>
                            <td className="py-2 text-xs text-muted-foreground">
                              {new Date(d.created_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-border bg-card/60 p-5">
                <h2 className="text-sm font-medium text-foreground">{t("pay.recentWithdrawals")}</h2>
                {withdrawals.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">{t("pay.noWithdrawals")}</p>
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs uppercase text-muted-foreground">
                          <th className="py-2 text-start font-medium">{t("pay.colAmount")}</th>
                          <th className="py-2 text-start font-medium">{t("pay.colNetwork")}</th>
                          <th className="py-2 text-start font-medium">{t("pay.colStatus")}</th>
                          <th className="py-2 text-start font-medium">{t("pay.colDate")}</th>
                          <th className="py-2 text-end font-medium" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {withdrawals.map((w) => (
                          <tr key={w.id}>
                            <td className="py-2 font-mono text-foreground" dir="ltr">
                              {num(w.amount, 8)} {w.currency}
                            </td>
                            <td className="py-2 text-muted-foreground">{w.network}</td>
                            <td className="py-2">
                              <StatusBadge status={w.status} />
                            </td>
                            <td className="py-2 text-xs text-muted-foreground">
                              {new Date(w.requested_at).toLocaleDateString()}
                            </td>
                            <td className="py-2 text-end">
                              {["REQUESTED", "RISK_REVIEW"].includes(w.status) && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={cancelMutation.isPending}
                                  onClick={() => cancelMutation.mutate(w.id)}
                                >
                                  {t("pay.cancel")}
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>

            <section className="grid gap-4 rounded-2xl border border-border bg-card/60 p-5 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { title: t("pay.infoMinDeposit"), detail: `${num(minDeposit)} ${walletCurrency}` },
                { title: t("pay.infoInstantCredit"), detail: t("pay.infoInstantCreditDetail") },
                { title: t("pay.infoSecure"), detail: t("pay.infoSecureDetail") },
                { title: t("pay.infoNeedHelp"), detail: t("pay.infoNeedHelpDetail") },
              ].map((item) => (
                <div key={item.title}>
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.detail}</p>
                </div>
              ))}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function MethodChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "border-primary/60 bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase();
  const tone = ["CONFIRMED", "APPROVED", "PAID", "COMPLETED"].includes(s)
    ? "border-primary/50 bg-primary/10 text-primary"
    : ["FAILED", "REJECTED", "CANCELLED"].includes(s)
      ? "border-destructive/50 bg-destructive/10 text-destructive"
      : "border-border bg-muted/30 text-muted-foreground";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone}`}>
      {s.replace(/_/g, " ").toLowerCase()}
    </span>
  );
}