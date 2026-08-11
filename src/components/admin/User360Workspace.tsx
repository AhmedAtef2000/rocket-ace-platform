import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  BadgeCheck,
  Ban,
  ChevronDown,
  Coins,
  FileText,
  Loader2,
  LockKeyhole,
  MessageSquare,
  ShieldAlert,
  Trash2,
} from "lucide-react";

import { useI18n, type TranslationKey } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  adjustUser360Balance,
  decideUser360Kyc,
  deleteUser360Note,
  getUser360Activity,
  getUser360Bets,
  getUser360Header,
  getUser360Kyc,
  getUser360Responsible,
  getUser360Risk,
  getUser360Security,
  getUser360Summary,
  getUser360Support,
  getUser360Transactions,
  getUser360Wallets,
  listUser360Notes,
  runUser360Action,
  saveUser360Note,
} from "@/lib/user360.functions";
import { setUserRealMoneyEnabled } from "@/lib/backoffice.functions";

type Tab =
  | "overview"
  | "betting"
  | "wallet"
  | "transactions"
  | "kyc"
  | "security"
  | "risk"
  | "responsible"
  | "support"
  | "activity"
  | "notes";

const TABS: Tab[] = [
  "overview",
  "betting",
  "wallet",
  "transactions",
  "kyc",
  "security",
  "risk",
  "responsible",
  "support",
  "activity",
  "notes",
];

/* ----------------------------- presentation ---------------------------- */

function Card({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-border/70 bg-card/60 p-4 shadow-[0_0_40px_-30px_hsl(var(--primary))] ${className}`}
    >
      {title ? (
        <h3 className="mb-3 text-sm font-semibold tracking-tight text-foreground">{title}</h3>
      ) : null}
      {children}
    </section>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div className="rounded-xl border border-border/60 bg-secondary/20 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={`mt-1 font-display text-lg font-bold ${
          tone === "up" ? "text-primary" : tone === "down" ? "text-destructive" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/40 py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-end font-medium">{value ?? "—"}</span>
    </div>
  );
}

function Pill({ text, tone = "muted" }: { text: string; tone?: "ok" | "warn" | "bad" | "muted" }) {
  const cls =
    tone === "ok"
      ? "border-primary/50 bg-primary/10 text-primary"
      : tone === "warn"
        ? "border-amber-500/50 bg-amber-500/10 text-amber-400"
        : tone === "bad"
          ? "border-destructive/50 bg-destructive/10 text-destructive"
          : "border-border bg-secondary/40 text-muted-foreground";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}>
      {text}
    </span>
  );
}

function statusTone(status: string): "ok" | "warn" | "bad" | "muted" {
  if (["ACTIVE", "APPROVED", "CONFIRMED", "CASHED_OUT", "LOW", "RESOLVED", "COMPLETED"].includes(status)) return "ok";
  if (["PENDING", "PENDING_VERIFICATION", "REQUIRES_INFORMATION", "MEDIUM", "REVIEW", "CONFIRMING", "OPEN"].includes(status))
    return "warn";
  if (["SUSPENDED", "CLOSED", "REJECTED", "LOST", "HIGH", "FAILED", "RESTRICTED", "SELF_EXCLUDED"].includes(status))
    return "bad";
  return "muted";
}

function Loading() {
  return (
    <div className="grid place-items-center py-10 text-muted-foreground">
      <Loader2 className="size-5 animate-spin" aria-hidden />
    </div>
  );
}

function ErrorNote({ error }: { error: unknown }) {
  return (
    <Card>
      <p className="text-sm text-destructive">{(error as Error)?.message ?? "Error"}</p>
    </Card>
  );
}

/* -------------------------------- helpers ------------------------------ */

function useFormat() {
  const { lang } = useI18n();
  const locale = lang === "ar" ? "ar-EG" : lang === "de" ? "de-DE" : "en-US";
  return useMemo(
    () => ({
      money: (v: number, currency?: string) =>
        `${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0)}${
          currency ? ` ${currency}` : ""
        }`,
      number: (v: number, digits = 2) =>
        new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(v || 0),
      date: (v: string | null | undefined) => (v ? new Date(v).toLocaleDateString(locale) : "—"),
      dateTime: (v: string | null | undefined) => (v ? new Date(v).toLocaleString(locale) : "—"),
    }),
    [locale],
  );
}

/* ------------------------------ confirm modal --------------------------- */

function ActionDialog({
  open,
  label,
  pending,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  label: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const { t } = useI18n();
  const [reason, setReason] = useState("");
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5">
        <h3 className="font-display text-lg font-bold">{t("u360.confirmTitle")}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{label}</p>
        <p className="mt-2 text-xs text-muted-foreground">{t("u360.confirmBody")}</p>
        <label className="mt-4 block text-xs font-medium text-muted-foreground" htmlFor="u360-reason">
          {t("u360.reason")}
        </label>
        <textarea
          id="u360-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder={t("u360.reasonPlaceholder")}
          className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-sm"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            {t("u360.cancel")}
          </Button>
          <Button disabled={pending || !reason.trim()} onClick={() => onConfirm(reason.trim())}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : t("u360.confirm")}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- table -------------------------------- */

function DataTable({
  columns,
  rows,
  onRow,
}: {
  columns: string[];
  rows: React.ReactNode[][];
  onRow?: (index: number) => void;
}) {
  const { t } = useI18n();
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted-foreground">{t("u360.empty")}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="text-start text-[11px] uppercase tracking-wide text-muted-foreground">
            {columns.map((c) => (
              <th key={c} className="px-2 py-2 text-start font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr
              key={i}
              onClick={onRow ? () => onRow(i) : undefined}
              className={`border-t border-border/40 ${onRow ? "cursor-pointer hover:bg-secondary/30" : ""}`}
            >
              {cells.map((cell, j) => (
                <td key={j} className="px-2 py-2 align-middle">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Pagination({
  page,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
}) {
  const { t } = useI18n();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
      <span>{t("u360.pageOf", { page: String(page), pages: String(pages), total: String(total) })}</span>
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          {t("u360.prev")}
        </Button>
        <Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          {t("u360.next")}
        </Button>
      </div>
    </div>
  );
}

function Filters({
  state,
  onChange,
  options,
}: {
  state: { search: string; from: string; to: string; filter: string };
  onChange: (next: { search: string; from: string; to: string; filter: string }) => void;
  options?: { value: string; label: string }[];
}) {
  const { t } = useI18n();
  return (
    <div className="mb-3 flex flex-wrap items-end gap-2">
      <input
        value={state.search}
        onChange={(e) => onChange({ ...state, search: e.target.value })}
        placeholder={t("u360.search")}
        className="min-w-[180px] flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />
      <label className="text-xs text-muted-foreground">
        {t("u360.filter.from")}
        <input
          type="date"
          value={state.from}
          onChange={(e) => onChange({ ...state, from: e.target.value })}
          className="ms-2 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
        />
      </label>
      <label className="text-xs text-muted-foreground">
        {t("u360.filter.to")}
        <input
          type="date"
          value={state.to}
          onChange={(e) => onChange({ ...state, to: e.target.value })}
          className="ms-2 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
        />
      </label>
      {options ? (
        <select
          value={state.filter}
          onChange={(e) => onChange({ ...state, filter: e.target.value })}
          className="rounded-lg border border-border bg-background px-2 py-2 text-sm"
        >
          <option value="">{t("u360.filter.all")}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}

/* --------------------------------- tabs --------------------------------- */

function OverviewTab({ userId }: { userId: string }) {
  const { t } = useI18n();
  const f = useFormat();
  const fn = useServerFn(getUser360Summary);
  const q = useQuery({ queryKey: ["u360", "summary", userId], queryFn: () => fn({ data: { userId } }) });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorNote error={q.error} />;
  const d = q.data;
  if (!d) return null;
  const max = Math.max(1, ...d.trend.map((p) => Math.abs(p.value)));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Kpi label={t("u360.kpi.totalBalance")} value={f.money(d.kpis.totalBalance)} />
        <Kpi label={t("u360.kpi.available")} value={f.money(d.kpis.available)} />
        <Kpi label={t("u360.kpi.pending")} value={f.money(d.kpis.pending)} />
        <Kpi label={t("u360.kpi.deposits")} value={f.money(d.kpis.totalDeposits)} tone="up" />
        <Kpi label={t("u360.kpi.withdrawals")} value={f.money(d.kpis.totalWithdrawals)} tone="down" />
        <Kpi label={t("u360.kpi.netDeposits")} value={f.money(d.kpis.netDeposits)} />
        <Kpi label={t("u360.kpi.wagered")} value={f.money(d.kpis.wagered)} />
        <Kpi label={t("u360.kpi.wins")} value={f.money(d.kpis.totalWins)} tone="up" />
        <Kpi label={t("u360.kpi.losses")} value={f.money(d.kpis.totalLosses)} tone="down" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t("u360.stats.title")}>
          <Row label={t("u360.stats.totalBets")} value={f.number(d.betting.totalBets, 0)} />
          <Row label={t("u360.stats.averageBet")} value={f.money(d.betting.averageBet)} />
          <Row label={t("u360.stats.largestBet")} value={f.money(d.betting.largestBet)} />
          <Row label={t("u360.stats.largestWin")} value={f.money(d.betting.largestWin)} />
          <Row label={t("u360.stats.largestLoss")} value={f.money(d.betting.largestLoss)} />
          <Row label={t("u360.stats.ratio")} value={f.number(d.betting.winLossRatio)} />
          <Row label={t("u360.stats.averageCashout")} value={`${f.number(d.betting.averageCashout)}×`} />
          <Row label={t("u360.stats.highestCashout")} value={`${f.number(d.betting.highestCashout)}×`} />
        </Card>

        <Card title={t("u360.stats.trend")}>
          <div className="flex h-40 items-end gap-1">
            {d.trend.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("u360.empty")}</p>
            ) : (
              d.trend.map((p) => (
                <div key={p.day} className="flex flex-1 flex-col items-center justify-end" title={`${p.day}: ${p.value}`}>
                  <div
                    className={`w-full rounded-t ${p.value >= 0 ? "bg-primary/70" : "bg-destructive/70"}`}
                    style={{ height: `${(Math.abs(p.value) / max) * 100}%` }}
                  />
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function BettingTab({ userId }: { userId: string }) {
  const { t } = useI18n();
  const f = useFormat();
  const fn = useServerFn(getUser360Bets);
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ search: "", from: "", to: "", filter: "" });
  const [detail, setDetail] = useState<number | null>(null);
  const q = useQuery({
    queryKey: ["u360", "bets", userId, page, state],
    queryFn: () => fn({ data: { userId, page, pageSize: 20, ...state } }),
  });
  if (q.error) return <ErrorNote error={q.error} />;
  const rows = q.data?.rows ?? [];
  const active = detail === null ? null : rows[detail];

  return (
    <Card>
      <Filters
        state={state}
        onChange={(next) => {
          setState(next);
          setPage(1);
        }}
        options={[
          { value: "WIN", label: t("u360.filter.win") },
          { value: "LOSS", label: t("u360.filter.loss") },
        ]}
      />
      {q.isLoading ? (
        <Loading />
      ) : (
        <DataTable
          onRow={(i) => setDetail(i)}
          columns={[
            t("u360.col.round"),
            t("u360.col.betAmount"),
            t("u360.col.cashout"),
            t("u360.col.crash"),
            t("u360.col.result"),
            t("u360.col.profit"),
            t("u360.col.date"),
          ]}
          rows={rows.map((r) => [
            <span className="font-mono text-xs">{r.roundNumber}</span>,
            f.money(r.amount, r.currency),
            r.cashout ? `${f.number(r.cashout)}×` : "—",
            r.crashPoint ? `${f.number(r.crashPoint)}×` : "—",
            <Pill text={r.result} tone={statusTone(r.result)} />,
            <span className={r.profit >= 0 ? "text-primary" : "text-destructive"}>{f.money(r.profit)}</span>,
            f.dateTime(r.placedAt),
          ])}
        />
      )}
      <Pagination page={page} total={q.data?.total ?? 0} pageSize={20} onPage={setPage} />

      {active ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 text-sm">
            <h3 className="font-display text-lg font-bold">{t("u360.roundDetails")}</h3>
            <div className="mt-3">
              <Row label={t("u360.betId")} value={<span className="font-mono text-xs">{active.betId}</span>} />
              <Row label={t("u360.col.round")} value={<span className="font-mono text-xs">{active.roundNumber}</span>} />
              <Row label={t("u360.col.betAmount")} value={f.money(active.amount, active.currency)} />
              <Row label={t("u360.col.cashout")} value={active.cashout ? `${f.number(active.cashout)}×` : "—"} />
              <Row label={t("u360.col.crash")} value={active.crashPoint ? `${f.number(active.crashPoint)}×` : "—"} />
              <Row label={t("u360.col.profit")} value={f.money(active.profit)} />
              <Row label={t("u360.gameStatus")} value={<Pill text={active.roundStatus} tone={statusTone(active.roundStatus)} />} />
              <Row label={t("u360.col.time")} value={f.dateTime(active.placedAt)} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{t("u360.fairnessNote")}</p>
            <div className="mt-4 flex justify-end">
              <Button variant="ghost" onClick={() => setDetail(null)}>
                {t("u360.close")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function WalletTab({ userId }: { userId: string }) {
  const { t } = useI18n();
  const f = useFormat();
  const fn = useServerFn(getUser360Summary);
  const q = useQuery({ queryKey: ["u360", "summary", userId], queryFn: () => fn({ data: { userId } }) });
  const walletsFn = useServerFn(getUser360Wallets);
  const adjustFn = useServerFn(adjustUser360Balance);
  const queryClient = useQueryClient();
  const accounts = useQuery({
    queryKey: ["u360", "walletAccounts", userId],
    queryFn: () => walletsFn({ data: { userId } }),
  });
  const [walletId, setWalletId] = useState("");
  const [direction, setDirection] = useState<"CREDIT" | "DEBIT">("CREDIT");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const adjust = useMutation({
    mutationFn: async () =>
      adjustFn({ data: { userId, walletId, direction, amount: Number(amount), reason } }),
    onSuccess: () => {
      toast.success(t("u360.balance.done"));
      setAmount("");
      setReason("");
      void queryClient.invalidateQueries({ queryKey: ["u360"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const walletRows = accounts.data?.wallets ?? [];
  const selected = walletId || walletRows[0]?.id || "";

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorNote error={q.error} />;
  const wallets = q.data?.wallets ?? [];
  return (
    <div className="space-y-4">
    <Card>
      <p className="mb-3 text-xs text-muted-foreground">{t("u360.wallet.ledgerNote")}</p>
      <DataTable
        columns={[
          t("u360.col.currency"),
          t("u360.wallet.available"),
          t("u360.wallet.pending"),
          t("u360.wallet.deposited"),
          t("u360.wallet.withdrawn"),
        ]}
        rows={wallets.map((w) => [
          <span className="font-semibold">{w.currency}</span>,
          f.money(w.available),
          f.money(w.pending),
          f.money(w.deposited),
          f.money(w.withdrawn),
        ])}
      />
    </Card>

    {accounts.data?.canAdjust ? (
      <Card title={t("u360.balance.title")}>
        <p className="mb-3 text-xs text-muted-foreground">{t("u360.balance.note")}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-medium text-muted-foreground">
            {t("u360.balance.wallet")}
            <select
              value={selected}
              onChange={(e) => setWalletId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-sm text-foreground"
            >
              {walletRows.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.kind} · {w.currency} — {f.money(w.available)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            {t("u360.balance.direction")}
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value === "DEBIT" ? "DEBIT" : "CREDIT")}
              className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-sm text-foreground"
            >
              <option value="CREDIT">{t("u360.balance.credit")}</option>
              <option value="DEBIT">{t("u360.balance.debit")}</option>
            </select>
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            {t("u360.balance.amount")}
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-sm text-foreground"
            />
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            {t("u360.reason")}
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("u360.reasonPlaceholder")}
              className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-sm text-foreground"
            />
          </label>
        </div>
        <Button
          className="mt-3"
          size="sm"
          disabled={adjust.isPending || !selected || !reason.trim() || !(Number(amount) > 0)}
          onClick={() => adjust.mutate()}
        >
          <Coins className="size-4" aria-hidden /> {t("u360.balance.apply")}
        </Button>
      </Card>
    ) : null}
    </div>
  );
}

function TransactionsTab({ userId }: { userId: string }) {
  const { t } = useI18n();
  const f = useFormat();
  const fn = useServerFn(getUser360Transactions);
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ search: "", from: "", to: "", filter: "" });
  const q = useQuery({
    queryKey: ["u360", "tx", userId, page, state],
    queryFn: () => fn({ data: { userId, page, pageSize: 20, ...state } }),
  });
  if (q.error) return <ErrorNote error={q.error} />;
  return (
    <Card>
      <Filters
        state={state}
        onChange={(next) => {
          setState(next);
          setPage(1);
        }}
        options={["DEPOSIT", "WITHDRAWAL", "BET", "WIN", "LOSS", "BONUS", "REFUND"].map((v) => ({
          value: v,
          label: v,
        }))}
      />
      {q.isLoading ? (
        <Loading />
      ) : (
        <DataTable
          columns={[
            t("u360.col.txId"),
            t("u360.col.type"),
            t("u360.col.amount"),
            t("u360.col.fee"),
            t("u360.col.status"),
            t("u360.col.method"),
            t("u360.col.network"),
            t("u360.col.date"),
          ]}
          rows={(q.data?.rows ?? []).map((r) => [
            <span className="font-mono text-[11px]">{r.id.slice(0, 12)}</span>,
            <Pill text={r.type} />,
            f.money(r.amount, r.currency),
            f.money(r.fee),
            <Pill text={r.status} tone={statusTone(r.status)} />,
            r.method ?? "—",
            r.network ?? "—",
            f.dateTime(r.date),
          ])}
        />
      )}
      <Pagination page={page} total={q.data?.total ?? 0} pageSize={20} onPage={setPage} />
    </Card>
  );
}

function KycTab({ userId, canDecide }: { userId: string; canDecide: boolean }) {
  const { t } = useI18n();
  const f = useFormat();
  const queryClient = useQueryClient();
  const fn = useServerFn(getUser360Kyc);
  const decide = useServerFn(decideUser360Kyc);
  const [reason, setReason] = useState("");
  const q = useQuery({ queryKey: ["u360", "kyc", userId], queryFn: () => fn({ data: { userId } }) });
  const m = useMutation({
    mutationFn: async (decision: string) => decide({ data: { userId, decision, reason } }),
    onSuccess: () => {
      toast.success(t("u360.actionDone"));
      setReason("");
      void queryClient.invalidateQueries({ queryKey: ["u360"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorNote error={q.error} />;
  const d = q.data;
  if (!d) return null;
  const current = d.cases[0];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title={t("u360.kyc.identity")}>
        <Row
          label={t("u360.kyc.identity")}
          value={<Pill text={current?.status ?? "NOT_STARTED"} tone={statusTone(current?.status ?? "")} />}
        />
        <Row
          label={t("u360.kyc.email")}
          value={<Pill text={d.emailVerified ? t("u360.verified") : t("u360.notVerified")} tone={d.emailVerified ? "ok" : "warn"} />}
        />
        <Row
          label={t("u360.kyc.phone")}
          value={<Pill text={d.phoneVerified ? t("u360.verified") : t("u360.notVerified")} tone={d.phoneVerified ? "ok" : "warn"} />}
        />
        <Row label={t("u360.kyc.submitted")} value={f.dateTime(current?.submitted_at)} />
        <Row label={t("u360.kyc.reviewed")} value={f.dateTime(current?.reviewed_at)} />
        <Row label={t("u360.kyc.reviewer")} value={current?.reviewer_id ? <span className="font-mono text-[11px]">{current.reviewer_id.slice(0, 8)}</span> : "—"} />
        <Row label={t("u360.kyc.reason")} value={current?.rejection_reason ?? "—"} />

        {canDecide ? (
          <div className="mt-4">
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("u360.reasonPlaceholder")}
              className="w-full rounded-lg border border-border bg-background p-2 text-sm"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" disabled={m.isPending} onClick={() => m.mutate("APPROVED")}>
                {t("u360.kyc.approve")}
              </Button>
              <Button size="sm" variant="destructive" disabled={m.isPending || !reason.trim()} onClick={() => m.mutate("REJECTED")}>
                {t("u360.kyc.reject")}
              </Button>
              <Button size="sm" variant="outline" disabled={m.isPending || !reason.trim()} onClick={() => m.mutate("REQUIRES_INFORMATION")}>
                {t("u360.kyc.requestInfo")}
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      <Card title={t("u360.kyc.documents")}>
        {!d.canSeeDocuments ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <LockKeyhole className="size-4" aria-hidden /> {t("u360.kyc.restricted")}
          </p>
        ) : d.documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("u360.kyc.noDocuments")}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {d.documents.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 p-2">
                <span className="flex items-center gap-2">
                  <FileText className="size-4 text-muted-foreground" aria-hidden />
                  <span>
                    <span className="block font-medium">{doc.docType}</span>
                    <span className="block text-[11px] text-muted-foreground">{f.date(doc.createdAt)}</span>
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <Pill text={doc.status} tone={statusTone(doc.status)} />
                  {doc.url ? (
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
                    >
                      {t("u360.kyc.view")}
                    </a>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function SecurityTab({ userId, onAction }: { userId: string; onAction: (action: string, label: string) => void }) {
  const { t } = useI18n();
  const f = useFormat();
  const fn = useServerFn(getUser360Security);
  const q = useQuery({ queryKey: ["u360", "security", userId], queryFn: () => fn({ data: { userId } }) });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorNote error={q.error} />;
  const d = q.data;
  if (!d) return null;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <Row
            label={t("u360.sec.mfa")}
            value={<Pill text={d.mfaEnabled ? t("u360.sec.enabled") : t("u360.sec.disabled")} tone={d.mfaEnabled ? "ok" : "warn"} />}
          />
          <Row label={t("u360.sec.password")} value={f.dateTime(d.passwordChangedAt)} />
          <Row label={t("u360.sec.sessions")} value={String(d.activeSessions)} />
          <Row label={t("u360.sec.failed")} value={String(d.failedLogins)} />
          <Row label={t("u360.lastLogin")} value={f.dateTime(d.lastLoginAt)} />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => onAction("force_logout", t("u360.sec.revoke"))}>
              {t("u360.sec.revoke")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => onAction("security_review", t("u360.securityReview"))}>
              {t("u360.securityReview")}
            </Button>
          </div>
        </Card>
        <Card title={t("u360.sec.activity")}>
          <DataTable
            columns={[t("u360.col.device"), t("u360.col.browser"), t("u360.col.os"), t("u360.col.ip"), t("u360.col.time")]}
            rows={d.sessions.map((s) => [
              s.device,
              s.browser,
              s.os,
              <span className="font-mono text-[11px]">{s.ip ?? "—"}</span>,
              f.dateTime(s.lastSeenAt),
            ])}
          />
        </Card>
      </div>
    </div>
  );
}

function RiskTab({ userId }: { userId: string }) {
  const { t } = useI18n();
  const f = useFormat();
  const fn = useServerFn(getUser360Risk);
  const q = useQuery({ queryKey: ["u360", "risk", userId], queryFn: () => fn({ data: { userId } }) });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorNote error={q.error} />;
  const d = q.data;
  if (!d) return null;
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="text-[11px] uppercase text-muted-foreground">{t("u360.risk.score")}</p>
            <p className="font-display text-3xl font-black">{d.score}</p>
          </div>
          <Pill text={d.level} tone={statusTone(d.level)} />
          <p className="max-w-md text-xs text-muted-foreground">{t("u360.risk.note")}</p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Kpi label={t("u360.risk.devices")} value={String(d.signals.devices)} />
          <Kpi label={t("u360.risk.ips")} value={String(d.signals.ips)} />
          <Kpi label={t("u360.risk.deposits")} value={String(d.signals.deposits)} />
          <Kpi label={t("u360.risk.withdrawals")} value={String(d.signals.withdrawals)} />
          <Kpi label={t("u360.risk.bets")} value={String(d.signals.bets)} />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t("u360.risk.factors")}>
          {d.factors.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("u360.risk.noFactors")}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {d.factors.map((factor) => (
                <li key={factor.label} className="rounded-lg border border-border/60 p-2">
                  <p className="flex items-center justify-between font-medium">
                    {factor.label} <span className="text-primary">+{factor.points}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{factor.explanation}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={t("u360.risk.alerts")}>
          <DataTable
            columns={[t("u360.col.event"), t("u360.risk.score"), t("u360.col.status"), t("u360.col.date")]}
            rows={d.events.map((e) => [
              <span>
                <span className="block font-medium">{e.event_type}</span>
                <span className="block text-[11px] text-muted-foreground">{e.description ?? ""}</span>
              </span>,
              String(e.risk_score),
              <Pill text={e.status} tone={statusTone(e.status)} />,
              f.dateTime(e.created_at),
            ])}
          />
        </Card>
      </div>
    </div>
  );
}

function ResponsibleTab({ userId }: { userId: string }) {
  const { t } = useI18n();
  const f = useFormat();
  const fn = useServerFn(getUser360Responsible);
  const q = useQuery({ queryKey: ["u360", "rg", userId], queryFn: () => fn({ data: { userId } }) });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorNote error={q.error} />;
  const d = q.data;
  if (!d) return null;
  const l = d.limits;
  const money = (v: number | null | undefined) => (v == null ? t("u360.rg.none") : f.money(Number(v)));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title={t("u360.tab.responsible")}>
        <Row label={t("u360.rg.daily")} value={money(l?.deposit_daily_limit as number | null)} />
        <Row label={t("u360.rg.weekly")} value={money(l?.deposit_weekly_limit as number | null)} />
        <Row label={t("u360.rg.monthly")} value={money(l?.deposit_monthly_limit as number | null)} />
        <Row
          label={t("u360.rg.session")}
          value={l?.session_limit_minutes ? t("u360.rg.minutes", { value: String(l.session_limit_minutes) }) : t("u360.rg.none")}
        />
        <Row label={t("u360.rg.cooling")} value={l?.cooling_off_until ? f.dateTime(l.cooling_off_until) : t("u360.rg.none")} />
        <Row label={t("u360.rg.exclusion")} value={l?.self_exclusion_until ? f.dateTime(l.self_exclusion_until) : t("u360.rg.none")} />
      </Card>
      <Card title={t("u360.rg.chasing")}>
        <Row label={t("u360.rg.chasing")} value={String(d.lossChasingSignals)} />
        <Row label={t("u360.rg.duration")} value={t("u360.rg.minutes", { value: String(d.averageSessionMinutes) })} />
        <Row label={t("u360.rg.frequency")} value={f.number(d.betsPerDay, 1)} />
        <div className="mt-3">
          <DataTable
            columns={[t("u360.col.event"), t("u360.col.date")]}
            rows={d.events.map((e) => [e.event_type, f.dateTime(e.created_at)])}
          />
        </div>
      </Card>
    </div>
  );
}

function SupportTab({ userId }: { userId: string }) {
  const { t } = useI18n();
  const f = useFormat();
  const fn = useServerFn(getUser360Support);
  const [open, setOpen] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["u360", "support", userId], queryFn: () => fn({ data: { userId } }) });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorNote error={q.error} />;
  const d = q.data;
  if (!d) return null;
  return (
    <div className="space-y-3">
      {d.tickets.length === 0 ? (
        <Card>
          <p className="text-sm text-muted-foreground">{t("u360.empty")}</p>
        </Card>
      ) : null}
      {d.tickets.map((ticket) => {
        const messages = d.messages.filter((m) => m.ticket_id === ticket.id);
        const expanded = open === ticket.id;
        return (
          <Card key={ticket.id}>
            <button
              type="button"
              onClick={() => setOpen(expanded ? null : ticket.id)}
              className="flex w-full flex-wrap items-center justify-between gap-2 text-start"
            >
              <span>
                <span className="block font-medium">{ticket.subject}</span>
                <span className="block font-mono text-[11px] text-muted-foreground">
                  {ticket.reference} · {ticket.category} · {ticket.priority}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <Pill text={ticket.status} tone={statusTone(ticket.status)} />
                <span className="text-[11px] text-muted-foreground">{f.dateTime(ticket.created_at)}</span>
                <ChevronDown className={`size-4 transition ${expanded ? "rotate-180" : ""}`} aria-hidden />
              </span>
            </button>
            {expanded ? (
              <ul className="mt-3 space-y-2 border-t border-border/50 pt-3 text-sm">
                {messages.map((m) => (
                  <li key={m.id} className="rounded-lg border border-border/50 p-2">
                    <p className="text-[11px] uppercase text-muted-foreground">
                      {m.author_type} · {f.dateTime(m.created_at)} {m.internal_note ? "· internal" : ""}
                    </p>
                    <p className="mt-1">{m.body}</p>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}

function ActivityTab({ userId }: { userId: string }) {
  const { t } = useI18n();
  const f = useFormat();
  const fn = useServerFn(getUser360Activity);
  const q = useQuery({ queryKey: ["u360", "activity", userId], queryFn: () => fn({ data: { userId } }) });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorNote error={q.error} />;
  return (
    <Card>
      <DataTable
        columns={[t("u360.col.event"), t("u360.col.source"), t("u360.col.status"), t("u360.col.time")]}
        rows={(q.data ?? []).map((e) => [
          <span>
            <span className="block font-medium">{e.event}</span>
            <span className="block text-[11px] text-muted-foreground">{e.detail}</span>
          </span>,
          e.source,
          <Pill text={e.status} tone={statusTone(e.status)} />,
          f.dateTime(e.at),
        ])}
      />
    </Card>
  );
}

function NotesTab({ userId }: { userId: string }) {
  const { t } = useI18n();
  const f = useFormat();
  const queryClient = useQueryClient();
  const listFn = useServerFn(listUser360Notes);
  const saveFn = useServerFn(saveUser360Note);
  const deleteFn = useServerFn(deleteUser360Note);
  const [body, setBody] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  const q = useQuery({ queryKey: ["u360", "notes", userId], queryFn: () => listFn({ data: { userId } }) });
  const save = useMutation({
    mutationFn: async () => saveFn({ data: { userId, body, id: editing } }),
    onSuccess: () => {
      toast.success(t("u360.notes.saved"));
      setBody("");
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey: ["u360", "notes", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success(t("u360.notes.deleted"));
      void queryClient.invalidateQueries({ queryKey: ["u360", "notes", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorNote error={q.error} />;

  return (
    <Card title={t("u360.notes.title")}>
      <p className="mb-3 text-xs text-muted-foreground">{t("u360.notes.private")}</p>
      {q.data?.canWrite ? (
        <div className="mb-4">
          <textarea
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t("u360.notes.placeholder")}
            className="w-full rounded-lg border border-border bg-background p-2 text-sm"
          />
          <div className="mt-2 flex gap-2">
            <Button size="sm" disabled={save.isPending || !body.trim()} onClick={() => save.mutate()}>
              {editing ? t("u360.notes.save") : t("u360.notes.add")}
            </Button>
            {editing ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(null);
                  setBody("");
                }}
              >
                {t("u360.cancel")}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {(q.data?.notes ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("u360.notes.empty")}</p>
      ) : (
        <ul className="space-y-2">
          {(q.data?.notes ?? []).map((note) => (
            <li key={note.id} className="rounded-lg border border-border/60 p-3 text-sm">
              <p className="whitespace-pre-wrap">{note.body}</p>
              <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{t("u360.notes.by", { role: note.author_role ?? "—", date: f.dateTime(note.created_at) })}</span>
                {q.data?.canWrite ? (
                  <span className="flex gap-2">
                    <button
                      type="button"
                      className="font-semibold text-primary"
                      onClick={() => {
                        setEditing(note.id);
                        setBody(note.body);
                      }}
                    >
                      {t("u360.notes.edit")}
                    </button>
                    <button
                      type="button"
                      className="flex items-center gap-1 font-semibold text-destructive"
                      onClick={() => remove.mutate(note.id)}
                    >
                      <Trash2 className="size-3" aria-hidden />
                      {t("u360.notes.delete")}
                    </button>
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ------------------------------- workspace ------------------------------ */

export function User360Workspace({ userId }: { userId: string }) {
  const { t } = useI18n();
  const f = useFormat();
  const queryClient = useQueryClient();
  const headerFn = useServerFn(getUser360Header);
  const actionFn = useServerFn(runUser360Action);
  const realMoneyFn = useServerFn(setUserRealMoneyEnabled);
  const [tab, setTab] = useState<Tab>("overview");
  const [pending, setPending] = useState<{ action: string; label: string } | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  const header = useQuery({
    queryKey: ["u360", "header", userId],
    queryFn: () => headerFn({ data: { userId } }),
  });

  const action = useMutation({
    mutationFn: async (input: { action: string; reason: string }) =>
      actionFn({ data: { userId, action: input.action, reason: input.reason } }),
    onSuccess: () => {
      toast.success(t("u360.actionDone"));
      setPending(null);
      void queryClient.invalidateQueries({ queryKey: ["u360"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const realMoney = useMutation({
    mutationFn: async (enabled: boolean) =>
      realMoneyFn({ data: { userId, enabled, note: `Toggled by admin` } }),
    onSuccess: () => {
      toast.success(t("u360.realMoneyToggled"));
      void queryClient.invalidateQueries({ queryKey: ["u360"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (header.isLoading) return <Loading />;
  if (header.error) return <ErrorNote error={header.error} />;
  const h = header.data?.header;
  const permissions = header.data?.permissions ?? [];
  if (!h) return <ErrorNote error={new Error(t("u360.notFound"))} />;

  const can = (p: string) => permissions.includes(p);
  const name = [h.firstName, h.lastName].filter(Boolean).join(" ") || h.handle;
  const initials = name.slice(0, 2).toUpperCase();
  const ask = (action_: string, label: string) => setPending({ action: action_, label });

  const moreActions: { key: string; label: string; show: boolean }[] = [
    { key: "restrict_betting", label: t("u360.restrictBetting"), show: can("user.suspend") },
    { key: "restrict_withdrawals", label: t("u360.restrictWithdrawals"), show: can("user.suspend") },
    { key: "require_kyc", label: t("u360.requireKyc"), show: can("kyc.decide") },
    { key: "require_verification", label: t("u360.requireVerification"), show: can("kyc.decide") || can("user.suspend") },
    { key: "force_logout", label: t("u360.forceLogout"), show: can("user.suspend") || can("risk.resolve") },
    { key: "security_review", label: t("u360.securityReview"), show: can("risk.resolve") || can("user.suspend") },
    { key: "close", label: t("u360.closeAccount"), show: can("user.suspend") },
    { key: "unsuspend", label: t("u360.unban"), show: can("user.suspend") },
  ].filter((a) => a.show);

  return (
    <div className="space-y-4">
      <Link
        to="/admin"
        search={{ section: "users" }}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
        {t("u360.back")}
      </Link>

      {/* Sticky identity header */}
      <div className="sticky top-14 z-30 rounded-2xl border border-border/70 bg-card/90 p-4 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-thrust font-display text-lg font-black text-primary-foreground">
            {initials}
          </span>
          <div className="min-w-[200px]">
            <p className="font-display text-xl font-black tracking-tight">{name}</p>
            <p className="text-xs text-muted-foreground">
              {h.handle} · {h.email}
            </p>
            <p className="font-mono text-[11px] text-muted-foreground">
              {t("u360.id")}: {h.accountNumber ?? "—"} · {h.id.slice(0, 8)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Pill text={h.status} tone={statusTone(h.status)} />
            <Pill text={`KYC ${h.kycStatus}`} tone={statusTone(h.kycStatus)} />
            <Pill text={`${t("u360.risk.level")}: ${h.riskLevel}`} tone={statusTone(String(h.riskLevel))} />
            {h.mfaEnabled ? <Pill text="2FA" tone="ok" /> : null}
          </div>

          <div className="ms-auto text-end">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("u360.balance")}</p>
            <p className="font-display text-xl font-bold text-primary">{f.money(h.balance)}</p>
            <p className="text-[11px] text-muted-foreground">
              {t("u360.registered")}: {f.date(h.createdAt)} · {t("u360.lastLogin")}: {f.dateTime(h.lastLoginAt)}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {can("user.suspend") ? (
            h.status !== "ACTIVE" ? (
              <Button size="sm" onClick={() => ask("unsuspend", t("u360.unban"))}>
                <BadgeCheck className="size-4" aria-hidden /> {t("u360.unban")}
              </Button>
            ) : (
              <Button size="sm" variant="destructive" onClick={() => ask("suspend", t("u360.suspend"))}>
                <Ban className="size-4" aria-hidden /> {t("u360.suspend")}
              </Button>
            )
          ) : null}
          {can("user.suspend") ? (
            <Button size="sm" variant="outline" onClick={() => ask("restrict", t("u360.restrict"))}>
              <ShieldAlert className="size-4" aria-hidden /> {t("u360.restrict")}
            </Button>
          ) : null}
          {can("support.reply") ? (
            <Button size="sm" variant="outline" onClick={() => ask("message", t("u360.message"))}>
              <MessageSquare className="size-4" aria-hidden /> {t("u360.message")}
            </Button>
          ) : null}
          {can("user.suspend") ? (
            <Button
              size="sm"
              variant={h.realMoneyEnabled ? "default" : "outline"}
              disabled={realMoney.isPending}
              onClick={() => realMoney.mutate(!h.realMoneyEnabled)}
            >
              <Coins className="size-4" aria-hidden />
              {h.realMoneyEnabled ? t("u360.disableRealMoney") : t("u360.enableRealMoney")}
            </Button>
          ) : null}

          {moreActions.length ? (
            <div className="relative">
              <Button size="sm" variant="ghost" onClick={() => setMoreOpen((v) => !v)}>
                {t("u360.more")} <ChevronDown className="size-4" aria-hidden />
              </Button>
              {moreOpen ? (
                <ul className="absolute z-40 mt-1 w-56 overflow-hidden rounded-xl border border-border bg-card text-sm shadow-xl">
                  {moreActions.map((a) => (
                    <li key={a.key}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-start hover:bg-secondary/50"
                        onClick={() => {
                          setMoreOpen(false);
                          ask(a.key, a.label);
                        }}
                      >
                        {a.label}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-border/60 bg-secondary/20 p-1">
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              tab === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t(`u360.tab.${key}` as TranslationKey)}
          </button>
        ))}
      </div>

      {tab === "overview" ? <OverviewTab userId={userId} /> : null}
      {tab === "betting" ? <BettingTab userId={userId} /> : null}
      {tab === "wallet" ? <WalletTab userId={userId} /> : null}
      {tab === "transactions" ? <TransactionsTab userId={userId} /> : null}
      {tab === "kyc" ? <KycTab userId={userId} canDecide={can("kyc.decide")} /> : null}
      {tab === "security" ? <SecurityTab userId={userId} onAction={ask} /> : null}
      {tab === "risk" ? <RiskTab userId={userId} /> : null}
      {tab === "responsible" ? <ResponsibleTab userId={userId} /> : null}
      {tab === "support" ? <SupportTab userId={userId} /> : null}
      {tab === "activity" ? <ActivityTab userId={userId} /> : null}
      {tab === "notes" ? <NotesTab userId={userId} /> : null}

      <ActionDialog
        open={!!pending}
        label={pending?.label ?? ""}
        pending={action.isPending}
        onCancel={() => setPending(null)}
        onConfirm={(reason) => pending && action.mutate({ action: pending.action, reason })}
      />
    </div>
  );
}