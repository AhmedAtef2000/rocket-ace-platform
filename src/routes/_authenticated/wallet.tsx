import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import QRCode from "qrcode";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BadgeCheck,
  CheckCircle2,
  ClipboardPaste,
  Copy,
  ExternalLink,
  HelpCircle,
  Layers,
  LifeBuoy,
  Loader2,
  ShieldCheck,
  Wallet as WalletIcon,
} from "lucide-react";

import {
  cancelWithdrawal,
  createDeposit,
  getPaymentsOverview,
  requestWithdrawal,
} from "@/lib/payments.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  CRYPTO_META,
  CRYPTO_ORDER,
  explorerUrl,
  fiatEquivalent,
  formatAmount,
  isValidAddress,
  networkLabel,
  shortHash,
  statusTone,
} from "@/lib/wallet-ui";

const title = "Wallet — deposits & withdrawals | AstroBet";
const description =
  "Fund your AstroBet account with USDT, USDC, BTC or ETH, track confirmations, and withdraw to your own wallet with server-verified balances.";

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

type Tab = "DEPOSIT" | "WITHDRAW";

type DetailRow = {
  kind: "Deposit" | "Withdrawal";
  id: string;
  currency: string;
  network: string;
  amount: string | number | null;
  fee?: string | number | null;
  status: string;
  createdAt: string;
  updatedAt?: string | null;
  hash?: string | null;
  address?: string | null;
  confirmations?: string | null;
};

function WalletPage() {
  const queryClient = useQueryClient();
  const fetchOverview = useServerFn(getPaymentsOverview);
  const newDeposit = useServerFn(createDeposit);
  const withdraw = useServerFn(requestWithdrawal);
  const cancel = useServerFn(cancelWithdrawal);

  const [tab, setTab] = useState<Tab>("DEPOSIT");
  const [currency, setCurrency] = useState("USDT");
  const [network, setNetwork] = useState("TRON");
  const [depAmount, setDepAmount] = useState("100");
  const [wdAmount, setWdAmount] = useState("");
  const [wdAddress, setWdAddress] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [receipt, setReceipt] = useState<{ id: string; status: string } | null>(null);
  const [detail, setDetail] = useState<DetailRow | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const submitting = useRef(false);

  const overview = useQuery({
    queryKey: ["payments", "overview"],
    queryFn: async () => fetchOverview({ data: undefined }),
  });

  const networks = overview.data?.networks ?? [];
  const currencies = useMemo(() => {
    const available = new Set(networks.map((n) => n.currency));
    const ordered = CRYPTO_ORDER.filter((c) => available.has(c)) as string[];
    for (const n of networks) if (!ordered.includes(n.currency)) ordered.push(n.currency);
    return ordered;
  }, [networks]);

  const currencyNetworks = useMemo(
    () => networks.filter((n) => n.currency === currency),
    [networks, currency],
  );

  // Never let an incompatible currency/network pair survive a switch.
  useEffect(() => {
    if (currencies.length && !currencies.includes(currency)) setCurrency(currencies[0]!);
  }, [currencies, currency]);
  useEffect(() => {
    if (currencyNetworks.length && !currencyNetworks.some((n) => n.network === network)) {
      setNetwork(currencyNetworks[0]!.network);
    }
  }, [currencyNetworks, network]);

  const selected = currencyNetworks.find((n) => n.network === network) ?? currencyNetworks[0] ?? null;

  const wallets = overview.data?.wallets ?? [];
  const deposits = overview.data?.deposits ?? [];
  const withdrawals = overview.data?.withdrawals ?? [];
  const eligible = overview.data?.realMoneyEligible ?? false;
  const blockedGate = overview.data?.gates?.find((g) => !g.passed && !g.internal);
  const playthrough = overview.data?.playthrough;
  const noticeHours = overview.data?.withdrawalNoticeHours ?? 24;

  const balanceOf = (code: string) => {
    const w = wallets.find((x) => x.currency === code);
    return {
      available: Number(w?.available_amount ?? 0),
      locked: Number(w?.locked_amount ?? 0),
    };
  };

  const totals = wallets.reduce(
    (acc, w) => {
      const fiat = fiatEquivalent(w.currency, Number(w.available_amount ?? 0));
      const fiatLocked = fiatEquivalent(w.currency, Number(w.locked_amount ?? 0));
      return {
        available: acc.available + (fiat ?? 0),
        pending: acc.pending + (fiatLocked ?? 0),
      };
    },
    { available: 0, pending: 0 },
  );

  const activeBalance = balanceOf(currency);
  const pendingDeposit = deposits.find((d) => d.currency === currency && d.status !== "CONFIRMED");
  const address = pendingDeposit?.deposit_address ?? null;

  useEffect(() => {
    let alive = true;
    if (!address) {
      setQr(null);
      return;
    }
    void QRCode.toDataURL(address, {
      margin: 1,
      width: 320,
      color: { dark: "#0b0f0c", light: "#ffffff" },
    }).then((url) => {
      if (alive) setQr(url);
    });
    return () => {
      alive = false;
    };
  }, [address]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["payments"] });
    void queryClient.invalidateQueries({ queryKey: ["wallet"] });
    void queryClient.invalidateQueries({ queryKey: ["account"] });
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

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Choose a network.");
      return withdraw({
        data: {
          currency: selected.currency,
          network: selected.network,
          amount: Number(wdAmount),
          destinationAddress: wdAddress.trim(),
        },
      });
    },
    onSuccess: (row) => {
      setReviewOpen(false);
      setReceipt({ id: row.id, status: row.status });
      setWdAmount("");
      setWdAddress("");
      invalidate();
    },
    onError: (error: Error) => {
      setReviewOpen(false);
      toast.error(error.message);
    },
    onSettled: () => {
      submitting.current = false;
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => cancel({ data: { id } }),
    onSuccess: () => {
      toast.success("Withdrawal cancelled and funds released.");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const decimals = selected?.decimals ?? 8;
  const wdValue = Number(wdAmount || 0);
  const feeRate = 0.01;
  const wdFee = wdValue > 0 ? wdValue * feeRate : 0;
  const wdNet = Math.max(wdValue - wdFee, 0);
  const addressValid = wdAddress.trim() !== "" && isValidAddress(network, wdAddress);
  const amountValid =
    wdValue > 0 && wdValue >= (selected?.minWithdrawal ?? 0) && wdValue <= activeBalance.available;

  const submitWithdrawal = () => {
    if (submitting.current || withdrawMutation.isPending) return;
    submitting.current = true;
    withdrawMutation.mutate();
  };

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied.`);
    } catch {
      toast.error("Copy is blocked by your browser.");
    }
  };

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-8">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Wallet</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Deposit, withdraw and track every on-chain movement.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatBox label="Total balance" value={`$${formatAmount(totals.available + totals.pending, 2)}`} tone="text-foreground" />
          <StatBox label="Available" value={`$${formatAmount(totals.available, 2)}`} tone="text-primary" />
          <StatBox label="Pending" value={`$${formatAmount(totals.pending, 2)}`} tone="text-amber-400" />
        </div>
      </header>

      {overview.isPending ? (
        <p className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your wallet…
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          {!eligible && (
            <section className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4">
              <h2 className="text-sm font-medium text-foreground">Verification required</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {blockedGate
                  ? `${blockedGate.label}: ${blockedGate.detail}`
                  : "Complete verification to unlock deposits and withdrawals."}
              </p>
              <Button asChild size="sm" variant="outline" className="mt-3">
                <Link to="/compliance">Complete verification</Link>
              </Button>
            </section>
          )}

          <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_300px]">
            {/* ---------- Wallet list ---------- */}
            <aside className="space-y-3">
              <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Layers className="h-3.5 w-3.5" /> Your wallets
              </h2>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                {currencies.map((code) => {
                  const nets = networks.filter((n) => n.currency === code);
                  const bal = balanceOf(code);
                  const fiat = fiatEquivalent(code, bal.available);
                  const active = code === currency;
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setCurrency(code)}
                      className={`w-full rounded-2xl border p-3 text-start transition-colors ${
                        active
                          ? "border-primary/60 bg-primary/10 shadow-[0_0_24px_-12px_var(--color-primary)]"
                          : "border-border bg-card/60 hover:border-primary/30"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border/60 bg-background/60 text-[11px] font-bold ${
                            CRYPTO_META[code]?.tint ?? "text-foreground"
                          }`}
                        >
                          {code.slice(0, 3)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-foreground">
                            {code}
                          </span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {nets.map((n) => networkLabel(n.network)).join(" · ")}
                          </span>
                        </span>
                      </div>
                      <p className="mt-2 font-mono text-sm text-foreground" dir="ltr">
                        {formatAmount(bal.available, 8)} {code}
                      </p>
                      <p className="text-[11px] text-muted-foreground" dir="ltr">
                        {fiat === null ? `${formatAmount(bal.locked, 8)} pending` : `≈ $${formatAmount(fiat, 2)}`}
                      </p>
                    </button>
                  );
                })}
              </div>
            </aside>

            {/* ---------- Main panel ---------- */}
            <section className="rounded-2xl border border-border bg-card/60">
              <div className="flex gap-6 border-b border-border px-5">
                {(["DEPOSIT", "WITHDRAW"] as Tab[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTab(value)}
                    className={`-mb-px flex items-center gap-2 border-b-2 py-3 text-sm font-semibold transition-colors ${
                      tab === value
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {value === "DEPOSIT" ? (
                      <ArrowDownToLine className="h-4 w-4" />
                    ) : (
                      <ArrowUpFromLine className="h-4 w-4" />
                    )}
                    {value === "DEPOSIT" ? "Deposit" : "Withdraw"}
                  </button>
                ))}
              </div>

              <div className="p-5">
                <div className="grid gap-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    1 · Select currency
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {currencies.map((code) => (
                      <Chip key={code} active={code === currency} onClick={() => setCurrency(code)}>
                        {code}
                      </Chip>
                    ))}
                  </div>
                </div>

                <div className="mt-4 grid gap-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    2 · Select network
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {currencyNetworks.map((n) => (
                      <Chip
                        key={n.network}
                        active={n.network === network}
                        onClick={() => setNetwork(n.network)}
                      >
                        {networkLabel(n.network)}
                      </Chip>
                    ))}
                  </div>
                </div>

                {tab === "DEPOSIT" ? (
                  <div className="mt-5 grid gap-5 xl:grid-cols-2">
                    <div className="grid content-start gap-3">
                      <div className="grid gap-2">
                        <Label htmlFor="dep-amount">Deposit amount (optional)</Label>
                        <div className="relative">
                          <Input
                            id="dep-amount"
                            inputMode="decimal"
                            value={depAmount}
                            onChange={(event) => setDepAmount(event.target.value)}
                          />
                          <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs text-muted-foreground">
                            {currency}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {[50, 100, 250, 500, 1000].map((v) => (
                            <Chip
                              key={v}
                              active={depAmount === String(v)}
                              onClick={() => setDepAmount(String(v))}
                            >
                              {v}
                            </Chip>
                          ))}
                        </div>
                      </div>

                      <dl className="grid gap-1.5 rounded-xl border border-border/60 bg-background/40 p-3 text-xs">
                        <Row label="Minimum deposit" value={`${formatAmount(selected?.minDeposit ?? 0, 8)} ${currency}`} />
                        <Row label="Network fee" value="Paid by the sending network" />
                        <Row label="Confirmations required" value={String(selected?.requiredConfirmations ?? "—")} />
                        <Row
                          label="Estimated received"
                          value={`${formatAmount(Number(depAmount || 0), decimals)} ${currency}`}
                          strong
                        />
                      </dl>

                      <Button
                        disabled={!eligible || depositMutation.isPending}
                        onClick={() => depositMutation.mutate()}
                      >
                        {depositMutation.isPending ? "Issuing…" : "Get deposit address"}
                      </Button>
                    </div>

                    <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
                      <h3 className="text-sm font-semibold text-foreground">
                        {currency} deposit address
                      </h3>
                      <div className="mt-3 grid place-items-center">
                        {qr ? (
                          <img
                            src={qr}
                            alt={`QR code for your ${currency} deposit address`}
                            className="h-40 w-40 rounded-xl border border-border/60 bg-card p-2"
                          />
                        ) : (
                          <div className="grid h-40 w-40 place-items-center rounded-xl border border-dashed border-border/60 text-center text-[11px] text-muted-foreground">
                            Generate an address to reveal your QR code
                          </div>
                        )}
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <p className="min-w-0 flex-1 break-all rounded-lg border border-border/60 bg-card/60 p-2 font-mono text-xs text-foreground">
                          {address ?? "No active address yet."}
                        </p>
                        <Button
                          size="icon"
                          variant="outline"
                          aria-label="Copy deposit address"
                          disabled={!address}
                          onClick={() => address && void copy(address, "Address")}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <dl className="mt-3 grid gap-1.5 text-xs">
                        <Row label="Network" value={networkLabel(network)} />
                        <Row
                          label="Confirmations"
                          value={`${pendingDeposit?.confirmations ?? 0} / ${
                            pendingDeposit?.required_confirmations ?? selected?.requiredConfirmations ?? 0
                          }`}
                        />
                        <Row label="Status" value={(pendingDeposit?.status ?? "AWAITING").toLowerCase()} />
                      </dl>
                      <p className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-300/90">
                        Send only {currency} using the {networkLabel(network)} network to this
                        address. Sending assets through the wrong network may result in permanent
                        loss.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 grid gap-5 xl:grid-cols-2">
                    <div className="grid content-start gap-3">
                      <div className="grid gap-2">
                        <div className="flex items-center justify-between gap-2">
                          <Label htmlFor="wd-address">3 · Destination address</Label>
                          <button
                            type="button"
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                            onClick={async () => {
                              try {
                                setWdAddress((await navigator.clipboard.readText()).trim());
                              } catch {
                                toast.error("Clipboard access is blocked by your browser.");
                              }
                            }}
                          >
                            <ClipboardPaste className="h-3.5 w-3.5" /> Paste
                          </button>
                        </div>
                        <Input
                          id="wd-address"
                          value={wdAddress}
                          placeholder={`Your ${currency} ${networkLabel(network)} address`}
                          onChange={(event) => setWdAddress(event.target.value)}
                          aria-invalid={wdAddress !== "" && !addressValid}
                          className={wdAddress !== "" && !addressValid ? "border-destructive" : ""}
                        />
                        {wdAddress !== "" && !addressValid && (
                          <p className="text-xs text-destructive">
                            That address is not valid for the {networkLabel(network)} network.
                          </p>
                        )}
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="wd-amount">4 · Amount</Label>
                        <div className="relative">
                          <Input
                            id="wd-amount"
                            inputMode="decimal"
                            value={wdAmount}
                            placeholder="0.00"
                            onChange={(event) => setWdAmount(event.target.value)}
                          />
                          <button
                            type="button"
                            onClick={() => setWdAmount(String(activeBalance.available))}
                            className="absolute inset-y-0 end-2 my-auto h-6 rounded-md border border-primary/40 px-2 text-[11px] font-semibold text-primary"
                          >
                            MAX
                          </button>
                        </div>
                      </div>

                      <dl className="grid gap-1.5 rounded-xl border border-border/60 bg-background/40 p-3 text-xs">
                        <Row
                          label="Available balance"
                          value={`${formatAmount(activeBalance.available, 8)} ${currency}`}
                        />
                        <Row
                          label="Minimum withdrawal"
                          value={`${formatAmount(selected?.minWithdrawal ?? 0, 8)} ${currency}`}
                        />
                        <Row
                          label="Maximum withdrawal"
                          value={`${formatAmount(activeBalance.available, 8)} ${currency}`}
                        />
                        <Row label="Network fee (1%)" value={`${formatAmount(wdFee, decimals)} ${currency}`} />
                        <Row
                          label="You will receive"
                          value={`${formatAmount(wdNet, decimals)} ${currency}`}
                          strong
                        />
                      </dl>

                      {playthrough && !playthrough.cleared && (
                        <p className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-300/90">
                          Anti-money-laundering rules require each deposit to be played through
                          once. {formatAmount(playthrough.remaining, 2)} of play remains.
                        </p>
                      )}

                      <Button
                        disabled={!eligible || !addressValid || !amountValid || withdrawMutation.isPending}
                        onClick={() => setReviewOpen(true)}
                      >
                        Continue
                      </Button>
                    </div>

                    <div className="grid content-start gap-3 rounded-2xl border border-border/60 bg-background/40 p-4 text-xs text-muted-foreground">
                      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <ShieldCheck className="h-4 w-4 text-primary" /> Withdrawal safety
                      </p>
                      <p>
                        Balances, fees and limits are calculated on the server — the values above
                        are re-verified before anything is released.
                      </p>
                      <p>
                        Funds are reserved the moment you confirm, and payouts are reviewed and
                        processed within {noticeHours} hours. Large payouts require two approvers.
                      </p>
                      <p>
                        We never ask for your private keys or seed phrase. Double-check the address
                        — blockchain transfers cannot be reversed.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* ---------- FAQ + support ---------- */}
            <aside className="space-y-4 xl:col-start-3 xl:row-start-1 xl:row-span-2">
              <section className="rounded-2xl border border-border bg-card/60 p-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <HelpCircle className="h-4 w-4 text-primary" /> FAQ
                </h2>
                <Accordion type="single" collapsible className="mt-2">
                  {FAQ.map((item, index) => (
                    <AccordionItem key={item.q} value={`faq-${index}`}>
                      <AccordionTrigger className="text-start text-xs">{item.q}</AccordionTrigger>
                      <AccordionContent className="text-xs text-muted-foreground">
                        {item.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </section>

              <section className="rounded-2xl border border-border bg-card/60 p-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <LifeBuoy className="h-4 w-4 text-primary" /> Need help?
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Our support team is here to help with any deposit or payout.
                </p>
                <Button asChild size="sm" className="mt-3 w-full">
                  <Link to="/support">Contact support</Link>
                </Button>
              </section>
            </aside>
          </div>

          {/* ---------- History ---------- */}
          <div className="grid gap-6 lg:grid-cols-2">
            <HistoryCard title="Deposit history" empty="No deposits yet.">
              {deposits.length > 0 && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs uppercase text-muted-foreground">
                      <th className="py-2 text-start font-medium">ID</th>
                      <th className="py-2 text-start font-medium">Currency</th>
                      <th className="py-2 text-start font-medium">Amount</th>
                      <th className="py-2 text-start font-medium">Network</th>
                      <th className="py-2 text-start font-medium">Status</th>
                      <th className="py-2 text-start font-medium">Date</th>
                      <th className="py-2 text-end font-medium">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {deposits.map((d) => (
                      <tr key={d.id}>
                        <td className="py-2 font-mono text-xs text-muted-foreground">
                          {shortHash(d.id, 4, 4)}
                        </td>
                        <td className="py-2 text-foreground">{d.currency}</td>
                        <td className="py-2 font-mono text-foreground" dir="ltr">
                          {formatAmount(d.confirmed_amount ?? d.requested_amount, 8)}
                        </td>
                        <td className="py-2 text-muted-foreground">{networkLabel(d.network)}</td>
                        <td className="py-2">
                          <StatusBadge status={d.status} />
                        </td>
                        <td className="py-2 text-xs text-muted-foreground">
                          {new Date(d.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-2 text-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setDetail({
                                kind: "Deposit",
                                id: d.id,
                                currency: d.currency,
                                network: d.network,
                                amount: d.confirmed_amount ?? d.requested_amount,
                                status: d.status,
                                createdAt: d.created_at,
                                updatedAt: d.updated_at,
                                hash: d.provider_transaction_id,
                                address: d.deposit_address,
                                confirmations: `${d.confirmations ?? 0} / ${d.required_confirmations}`,
                              })
                            }
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </HistoryCard>

            <HistoryCard title="Withdrawal history" empty="No withdrawals yet.">
              {withdrawals.length > 0 && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs uppercase text-muted-foreground">
                      <th className="py-2 text-start font-medium">ID</th>
                      <th className="py-2 text-start font-medium">Amount</th>
                      <th className="py-2 text-start font-medium">Fee</th>
                      <th className="py-2 text-start font-medium">Received</th>
                      <th className="py-2 text-start font-medium">Status</th>
                      <th className="py-2 text-end font-medium">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {withdrawals.map((w) => (
                      <tr key={w.id}>
                        <td className="py-2 font-mono text-xs text-muted-foreground">
                          {shortHash(w.id, 4, 4)}
                        </td>
                        <td className="py-2 font-mono text-foreground" dir="ltr">
                          {formatAmount(w.amount, 8)} {w.currency}
                        </td>
                        <td className="py-2 font-mono text-muted-foreground" dir="ltr">
                          {formatAmount(w.fee_amount, 8)}
                        </td>
                        <td className="py-2 font-mono text-primary" dir="ltr">
                          {formatAmount(Number(w.amount ?? 0) - Number(w.fee_amount ?? 0), 8)}
                        </td>
                        <td className="py-2">
                          <StatusBadge status={w.status} />
                        </td>
                        <td className="flex justify-end gap-1 py-2">
                          {["REQUESTED", "RISK_REVIEW"].includes(w.status) && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={cancelMutation.isPending}
                              onClick={() => cancelMutation.mutate(w.id)}
                            >
                              Cancel
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setDetail({
                                kind: "Withdrawal",
                                id: w.id,
                                currency: w.currency,
                                network: w.network,
                                amount: w.amount,
                                fee: w.fee_amount,
                                status: w.status,
                                createdAt: w.requested_at,
                                updatedAt: w.completed_at ?? w.processed_at ?? w.updated_at,
                                hash: w.provider_transaction_id,
                                address: w.destination_address,
                              })
                            }
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </HistoryCard>
          </div>

          <section className="grid gap-4 rounded-2xl border border-border bg-card/60 p-5 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { icon: WalletIcon, title: "Secure wallet", detail: "Server-authoritative balances" },
              { icon: BadgeCheck, title: "Blockchain verified", detail: "Every movement is auditable" },
              { icon: Layers, title: "Multiple networks", detail: "TRC20, ERC20 and native chains" },
              { icon: LifeBuoy, title: "24/7 support", detail: "Real humans, any time zone" },
              { icon: ShieldCheck, title: "Transparent fees", detail: "1% payout fee, shown upfront" },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-2">
                <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.detail}</p>
                </div>
              </div>
            ))}
          </section>
        </div>
      )}

      {/* ---------- Withdrawal review ---------- */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdrawal review</DialogTitle>
            <DialogDescription>
              Check every detail — blockchain transfers cannot be reversed.
            </DialogDescription>
          </DialogHeader>
          <dl className="grid gap-1.5 text-sm">
            <Row label="Currency" value={currency} />
            <Row label="Network" value={networkLabel(network)} />
            <Row label="Destination" value={shortHash(wdAddress.trim(), 10, 8)} />
            <Row label="Requested amount" value={`${formatAmount(wdValue, decimals)} ${currency}`} />
            <Row label="Network fee" value={`${formatAmount(wdFee, decimals)} ${currency}`} />
            <Row label="You receive" value={`${formatAmount(wdNet, decimals)} ${currency}`} strong />
            <Row label="Processing" value={`Up to ${noticeHours} hours`} />
          </dl>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(false)}>
              Back
            </Button>
            <Button disabled={withdrawMutation.isPending} onClick={submitWithdrawal}>
              {withdrawMutation.isPending ? "Submitting…" : "Confirm withdrawal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Withdrawal receipt ---------- */}
      <Dialog open={receipt !== null} onOpenChange={(open) => !open && setReceipt(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" /> Withdrawal submitted
            </DialogTitle>
            <DialogDescription>
              Your funds are reserved while our payouts team reviews the request.
            </DialogDescription>
          </DialogHeader>
          <dl className="grid gap-1.5 text-sm">
            <Row label="Transaction ID" value={receipt ? shortHash(receipt.id, 8, 6) : ""} />
            <Row
              label="Status"
              value={(receipt?.status ?? "").replace(/_/g, " ").toLowerCase()}
              strong
            />
            <Row label="Estimated processing" value={`Within ${noticeHours} hours`} />
          </dl>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceipt(null)}>
              Back to wallet
            </Button>
            <Button
              onClick={() => {
                const row = withdrawals.find((w) => w.id === receipt?.id);
                setReceipt(null);
                if (row) {
                  setDetail({
                    kind: "Withdrawal",
                    id: row.id,
                    currency: row.currency,
                    network: row.network,
                    amount: row.amount,
                    fee: row.fee_amount,
                    status: row.status,
                    createdAt: row.requested_at,
                    updatedAt: row.updated_at,
                    hash: row.provider_transaction_id,
                    address: row.destination_address,
                  });
                }
              }}
            >
              View transaction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Transaction details ---------- */}
      <Dialog open={detail !== null} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{detail?.kind} details</DialogTitle>
            <DialogDescription>Full record for this movement.</DialogDescription>
          </DialogHeader>
          {detail && (
            <dl className="grid gap-1.5 text-sm">
              <Row label="Transaction ID" value={detail.id} />
              <Row label="Type" value={detail.kind} />
              <Row label="Currency" value={detail.currency} />
              <Row label="Network" value={networkLabel(detail.network)} />
              <Row label="Amount" value={`${formatAmount(detail.amount, 8)} ${detail.currency}`} />
              {detail.fee !== undefined && (
                <Row label="Fee" value={`${formatAmount(detail.fee, 8)} ${detail.currency}`} />
              )}
              <Row label="Status" value={detail.status.replace(/_/g, " ").toLowerCase()} />
              <Row label="Created" value={new Date(detail.createdAt).toLocaleString()} />
              {detail.updatedAt && (
                <Row label="Updated" value={new Date(detail.updatedAt).toLocaleString()} />
              )}
              {detail.confirmations && <Row label="Confirmations" value={detail.confirmations} />}
              {detail.address && (
                <Row label="Address" value={shortHash(detail.address, 10, 8)} />
              )}
              {detail.hash && <Row label="Tx hash" value={shortHash(detail.hash, 10, 8)} />}
            </dl>
          )}
          <DialogFooter>
            {detail?.hash && explorerUrl(detail.network, detail.hash) && (
              <Button asChild variant="outline">
                <a
                  href={explorerUrl(detail.network, detail.hash)!}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <ExternalLink className="me-2 h-4 w-4" /> View on blockchain explorer
                </a>
              </Button>
            )}
            <Button onClick={() => setDetail(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

const FAQ = [
  {
    q: "How long does a crypto deposit take?",
    a: "Funds are credited automatically once the network reaches the required confirmations — usually a few minutes.",
  },
  {
    q: "How long does a withdrawal take?",
    a: "Most payouts are reviewed and released within 24 hours. Large amounts need two approvers.",
  },
  {
    q: "Which network should I use?",
    a: "Use the network selected in the deposit panel. TRC20 is the cheapest option for USDT.",
  },
  {
    q: "What happens if I use the wrong network?",
    a: "Funds sent over an unsupported network cannot be recovered. Always match the network shown with your address.",
  },
  {
    q: "What is the minimum deposit?",
    a: "The minimum is shown per currency and network in the deposit summary before you send anything.",
  },
  {
    q: "Are there withdrawal fees?",
    a: "A flat 1% network fee is applied and shown before you confirm the payout.",
  },
  {
    q: "Why is my withdrawal pending?",
    a: "Payouts pass through automated risk checks. If a manual review is needed, you will see the status change here.",
  },
  {
    q: "Why is KYC required?",
    a: "Licensing and anti-money-laundering rules require identity verification before real-money payouts.",
  },
];

function StatBox({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 px-4 py-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`mt-1 font-mono text-lg font-semibold ${tone}`} dir="ltr">
        {value}
      </p>
    </div>
  );
}

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
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
      {children}
    </button>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={`truncate font-mono ${strong ? "text-primary" : "text-foreground"}`}
        dir="ltr"
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}

function HistoryCard({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const hasContent = Boolean(children);
  return (
    <section className="rounded-2xl border border-border bg-card/60 p-5">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {hasContent ? (
        <div className="mt-3 overflow-x-auto">{children}</div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusTone(status)}`}
    >
      {status.replace(/_/g, " ").toLowerCase()}
    </span>
  );
}
