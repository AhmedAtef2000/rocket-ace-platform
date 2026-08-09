import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { useI18n, LANGUAGES, type TranslationKey } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";
import { AdminShell, type AdminSection } from "@/components/admin/AdminShell";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { AdminResourceTable } from "@/components/admin/AdminResourceTable";

import { Button } from "@/components/ui/button";
import {
  answerTicket,
  claimSuperAdmin,
  decideKyc,
  decideWithdrawal,
  getAdminOverview,
  getAdminSession,
  getAdminAnalytics,
  listAdminTickets,
  listAuditLogs,
  listKycQueue,
  listPendingWithdrawals,
  listRiskEvents,
  resolveRiskEvent,
  runRiskScan,
} from "@/lib/admin.functions";
import {
  adminUpdateUserProfile,
  decideKycDocument,
  decideManualDeposit,
  getPlatformSettings,
  getUserDossier,
  listManualDeposits,
  searchUsers,
  setUserStatus,
  updatePlatformSettings,
} from "@/lib/backoffice.functions";

const title = "Back office — AstroBet";
const description =
  "Operator console for withdrawal approvals, KYC decisions, risk events, support tickets and the audit trail.";

const SECTIONS: AdminSection[] = [
  "dashboard",
  "users",
  "kyc",
  "deposits",
  "withdrawals",
  "transactions",
  "wallets",
  "bets",
  "rounds",
  "gamesettings",
  "fairness",
  "limits",
  "risk",
  "banned",
  "ips",
  "devices",
  "promotions",
  "bonuses",
  "vip",
  "support",
  "messages",
  "announcements",
  "analytics",
  "reports",
  "audit",
  "syslogs",
  "admins",
  "backup",
  "currencies",
  "methods",
  "localization",
  "settings",
];

/** Sections backed by the shared read-only resource table. */
const RESOURCE_SECTIONS: Partial<Record<AdminSection, { permission: string; label: TranslationKey }>> = {
  transactions: { permission: "finance.view", label: "admin.nav.transactions" },
  wallets: { permission: "finance.view", label: "admin.nav.wallets" },
  bets: { permission: "analytics.view", label: "admin.nav.bets" },
  rounds: { permission: "analytics.view", label: "admin.nav.rounds" },
  gamesettings: { permission: "analytics.view", label: "admin.nav.gamesettings" },
  fairness: { permission: "analytics.view", label: "admin.nav.fairness" },
  limits: { permission: "user.view", label: "admin.nav.limits" },
  banned: { permission: "user.view", label: "admin.nav.banned" },
  ips: { permission: "risk.view", label: "admin.nav.ips" },
  devices: { permission: "risk.view", label: "admin.nav.devices" },
  promotions: { permission: "analytics.view", label: "admin.nav.promotions" },
  bonuses: { permission: "finance.view", label: "admin.nav.bonuses" },
  vip: { permission: "finance.view", label: "admin.nav.vip" },
  messages: { permission: "support.view", label: "admin.nav.messages" },
  announcements: { permission: "support.view", label: "admin.nav.announcements" },
  currencies: { permission: "analytics.view", label: "admin.nav.currencies" },
  methods: { permission: "analytics.view", label: "admin.nav.methods" },
  admins: { permission: "admin.manage", label: "admin.nav.admins" },
  syslogs: { permission: "audit.view", label: "admin.nav.syslogs" },
};

export const Route = createFileRoute("/_authenticated/admin")({
  validateSearch: (search: Record<string, unknown>): { section: AdminSection } => {
    const raw = typeof search["section"] === "string" ? (search["section"] as AdminSection) : "dashboard";
    return { section: SECTIONS.includes(raw) ? raw : "dashboard" };
  },
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
  component: AdminPage,
});

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function fmt(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function AdminPage() {
  const { t } = useI18n();
  const { section } = Route.useSearch();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fetchSession = useServerFn(getAdminSession);
  const claim = useServerFn(claimSuperAdmin);

  const session = useQuery({
    queryKey: ["admin", "session"],
    queryFn: async () => fetchSession({ data: undefined }),
  });

  const claimMutation = useMutation({
    mutationFn: async () => claim({ data: undefined }),
    onSuccess: () => {
      toast.success(t("admin.claimSuccess"));
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const identity = session.data?.identity ?? null;
  const can = (permission: string) => identity?.permissions.includes(permission) ?? false;

  if (!identity) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-8">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">{t("admin.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("admin.subtitle.staffOnly")}</p>
        {session.isLoading ? (
          <p className="mt-8 text-sm text-muted-foreground">{t("admin.loading")}</p>
        ) : session.data ? (
          <section className="mt-8 rounded-xl border border-border p-5">
            <h2 className="text-lg font-medium">{t("admin.noAccess.title")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("admin.noAccess.body")}{" "}
              {session.data.bootstrapAvailable
                ? t("admin.noAccess.bootstrap")
                : t("admin.noAccess.askAdmin")}
            </p>
            {session.data.bootstrapAvailable ? (
              <Button
                className="mt-4"
                disabled={claimMutation.isPending}
                onClick={() => claimMutation.mutate()}
              >
                {t("admin.claimSuperAdmin")}
              </Button>
            ) : null}
          </section>
        ) : null}
      </main>
    );
  }

  const resource = RESOURCE_SECTIONS[section as AdminSection];

  const body = (() => {
    if (resource) {
      return can(resource.permission) ? (
        <AdminResourceTable resource={section} title={t(resource.label)} subtitle={t("admin.res.subtitle")} />
      ) : null;
    }
    switch (section) {
      case "reports":
        return can("analytics.view") ? <AnalyticsSection /> : null;
      case "localization":
        return can("analytics.view") ? (
          <InfoSection title={t("admin.localization.title")} body={t("admin.localization.body")}>
            <ul className="mt-3 grid gap-2 sm:grid-cols-3">
              {LANGUAGES.map((language) => (
                <li key={language.code} className="rounded-lg border border-border px-3 py-2 text-sm font-semibold">
                  {language.label}
                  <span className="ms-2 text-xs uppercase text-muted-foreground">{language.code}</span>
                </li>
              ))}
            </ul>
          </InfoSection>
        ) : null;
      case "backup":
        return can("admin.manage") ? (
          <InfoSection title={t("admin.backup.title")} body={t("admin.backup.body")} />
        ) : null;
      case "users":
        return can("user.view") ? <UsersSection canManage={can("user.suspend")} /> : null;
      case "kyc":
        return can("kyc.view") ? <KycSection canDecide={can("kyc.decide")} /> : null;
      case "deposits":
        return can("finance.view") ? <ManualDepositsSection canApprove={can("withdrawal.approve")} /> : null;
      case "withdrawals":
        return can("withdrawal.review") ? <WithdrawalsSection canApprove={can("withdrawal.approve")} /> : null;
      case "risk":
        return can("risk.view") ? <RiskSection canResolve={can("risk.resolve")} /> : null;
      case "support":
        return can("support.view") ? <TicketsSection canReply={can("support.reply")} /> : null;
      case "analytics":
        return can("analytics.view") ? <AnalyticsSection /> : null;
      case "audit":
        return can("audit.view") ? <AuditSection /> : null;
      case "settings":
        return can("admin.manage") ? <SettingsSection /> : null;
      default:
        return can("analytics.view") ? <AdminDashboard can={can} /> : <OverviewSection />;
    }
  })();

  return (
    <AdminShell
      active={section}
      can={can}
      roleLabel={identity.roleKey.replace(/_/g, " ")}
      email={user?.email ?? null}
    >
      {body ?? <p className="text-sm text-muted-foreground">{t("admin.noAccess.askAdmin")}</p>}
    </AdminShell>
  );
}

function InfoSection({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h1 className="font-display text-2xl font-black tracking-tight">{title}</h1>
      <div className="rounded-xl border border-border bg-card/60 p-4">
        <p className="text-sm text-muted-foreground">{body}</p>
        {children}
      </div>
    </section>
  );
}

function OverviewSection() {
  const { t } = useI18n();
  const fetchOverview = useServerFn(getAdminOverview);
  const overview = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: async () => fetchOverview({ data: undefined }),
    refetchInterval: 15_000,
  });
  const d = overview.data;
  return (
    <section>
      <h2 className="text-lg font-medium">{t("admin.overview.title")}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Metric label={t("admin.overview.players")} value={d ? d.users : "—"} />
        <Metric label={t("admin.overview.rounds24h")} value={d ? d.rounds24h : "—"} />
        <Metric label={t("admin.overview.wagered24h")} value={d ? fmt(d.wagered24h) : "—"} />
        <Metric label={t("admin.overview.ggr24h")} value={d ? fmt(d.ggr24h) : "—"} />
        <Metric label={t("admin.overview.pendingPayouts")} value={d ? d.pendingWithdrawals : "—"} />
        <Metric label={t("admin.overview.payoutValue")} value={d ? fmt(d.pendingWithdrawalValue) : "—"} />
        <Metric label={t("admin.overview.openRiskEvents")} value={d ? d.openRiskEvents : "—"} />
        <Metric label={t("admin.overview.openTickets")} value={d ? d.openTickets : "—"} />
        <Metric label={t("admin.overview.kycQueue")} value={d ? d.pendingKyc : "—"} />
        <Metric label={t("admin.overview.ledgerDrift")} value={d ? d.driftedWallets : "—"} />
      </div>
    </section>
  );
}

function WithdrawalsSection({ canApprove }: { canApprove: boolean }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const fetchList = useServerFn(listPendingWithdrawals);
  const decide = useServerFn(decideWithdrawal);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const list = useQuery({
    queryKey: ["admin", "withdrawals"],
    queryFn: async () => fetchList({ data: undefined }),
  });

  const mutation = useMutation({
    mutationFn: async (input: { id: string; decision: "APPROVE" | "REJECT" }) =>
      decide({ data: { ...input, note: notes[input.id] ?? "" } }),
    onSuccess: () => {
      toast.success(t("admin.withdrawals.decisionRecorded"));
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <section>
      <h2 className="text-lg font-medium">{t("admin.withdrawals.title")}</h2>
      <div className="mt-4 space-y-3">
        {list.data?.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("admin.withdrawals.queueClear")}</p>
        ) : null}
        {(list.data ?? []).map((w) => (
          <article key={w.id} className="rounded-xl border border-border p-4">
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <div>
                <p className="font-medium">
                  {w.amount} {w.currency} · {w.network}
                </p>
                <p className="text-xs text-muted-foreground break-all">{w.destination_address}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("admin.withdrawals.statusLine", {
                    status: w.status,
                    risk: w.risk_status,
                    approvalsCount: w.approvals_count,
                    approvalsRequired: w.approvals_required,
                  })}
                </p>
              </div>
            </div>
            {canApprove ? (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  value={notes[w.id] ?? ""}
                  onChange={(e) => setNotes((p) => ({ ...p, [w.id]: e.target.value }))}
                  placeholder={t("admin.withdrawals.decisionNotePlaceholder")}
                  className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
                <Button
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate({ id: w.id, decision: "APPROVE" })}
                >
                  {t("admin.withdrawals.approve")}
                </Button>
                <Button
                  variant="destructive"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate({ id: w.id, decision: "REJECT" })}
                >
                  {t("admin.withdrawals.reject")}
                </Button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function KycSection({ canDecide }: { canDecide: boolean }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const fetchList = useServerFn(listKycQueue);
  const decide = useServerFn(decideKyc);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const list = useQuery({
    queryKey: ["admin", "kyc"],
    queryFn: async () => fetchList({ data: undefined }),
  });

  const mutation = useMutation({
    mutationFn: async (input: { id: string; decision: "APPROVED" | "REJECTED" }) =>
      decide({ data: { ...input, note: notes[input.id] ?? "" } }),
    onSuccess: () => {
      toast.success(t("admin.kyc.caseUpdated"));
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <section>
      <h2 className="text-lg font-medium">{t("admin.kyc.title")}</h2>
      <div className="mt-4 space-y-3">
        {list.data?.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("admin.kyc.empty")}</p>
        ) : null}
        {(list.data ?? []).map((c) => (
          <article key={c.id} className="rounded-xl border border-border p-4 text-sm">
            <p className="font-medium">
              {t("admin.kyc.statusLine", { status: c.status, risk: c.risk_level })}
            </p>
            <p className="text-xs text-muted-foreground break-all">{t("admin.kyc.userLabel", { id: c.user_id })}</p>
            {c.rejection_reason ? (
              <p className="mt-1 text-xs text-muted-foreground">{c.rejection_reason}</p>
            ) : null}
            {canDecide ? (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  value={notes[c.id] ?? ""}
                  onChange={(e) => setNotes((p) => ({ ...p, [c.id]: e.target.value }))}
                  placeholder={t("admin.kyc.notePlaceholder")}
                  className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
                <Button
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate({ id: c.id, decision: "APPROVED" })}
                >
                  {t("admin.kyc.approve")}
                </Button>
                <Button
                  variant="destructive"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate({ id: c.id, decision: "REJECTED" })}
                >
                  {t("admin.kyc.reject")}
                </Button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function RiskSection({ canResolve }: { canResolve: boolean }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const fetchList = useServerFn(listRiskEvents);
  const resolve = useServerFn(resolveRiskEvent);
  const scan = useServerFn(runRiskScan);

  const list = useQuery({
    queryKey: ["admin", "risk"],
    queryFn: async () => fetchList({ data: undefined }),
  });

  const scanMutation = useMutation({
    mutationFn: async () => scan({ data: undefined }),
    onSuccess: (result) => {
      toast.success(t("admin.risk.scanResult", { scanned: result.scanned, flagged: result.flagged }));
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const mutation = useMutation({
    mutationFn: async (input: { id: string; status: "RESOLVED" | "DISMISSED" | "ESCALATED" }) =>
      resolve({ data: input }),
    onSuccess: () => {
      toast.success(t("admin.risk.updated"));
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-medium">{t("admin.risk.title")}</h2>
        <Button
          variant="secondary"
          disabled={scanMutation.isPending}
          onClick={() => scanMutation.mutate()}
        >
          {scanMutation.isPending ? t("admin.risk.scanning") : t("admin.risk.runScan")}
        </Button>
      </div>
      <div className="mt-4 space-y-3">
        {list.data?.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("admin.risk.empty")}</p>
        ) : null}
        {(list.data ?? []).map((e) => (
          <article key={e.id} className="rounded-xl border border-border p-4 text-sm">
            <p className="font-medium">
              {t("admin.risk.eventLine", { type: e.event_type, score: e.risk_score, severity: e.severity })}
            </p>
            <p className="text-xs text-muted-foreground break-all">
              {t("admin.risk.sourceLine", { source: e.source, user: e.user_id ?? "—" })}
            </p>
            {e.description ? <p className="mt-1">{e.description}</p> : null}
            {canResolve ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => mutation.mutate({ id: e.id, status: "RESOLVED" })}
                >
                  {t("admin.risk.resolve")}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => mutation.mutate({ id: e.id, status: "ESCALATED" })}
                >
                  {t("admin.risk.escalate")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => mutation.mutate({ id: e.id, status: "DISMISSED" })}
                >
                  {t("admin.risk.dismiss")}
                </Button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function TicketsSection({ canReply }: { canReply: boolean }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const fetchList = useServerFn(listAdminTickets);
  const answer = useServerFn(answerTicket);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const list = useQuery({
    queryKey: ["admin", "tickets"],
    queryFn: async () => fetchList({ data: undefined }),
  });

  const mutation = useMutation({
    mutationFn: async (input: { ticketId: string; resolve: boolean }) =>
      answer({ data: { ...input, body: drafts[input.ticketId] ?? "" } }),
    onSuccess: (_r, input) => {
      toast.success(t("admin.tickets.sent"));
      setDrafts((p) => ({ ...p, [input.ticketId]: "" }));
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <section>
      <h2 className="text-lg font-medium">{t("admin.tickets.title")}</h2>
      <div className="mt-4 space-y-3">
        {list.data?.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("admin.tickets.empty")}</p>
        ) : null}
        {(list.data ?? []).map((ticket) => (
          <article key={ticket.id} className="rounded-xl border border-border p-4 text-sm">
            <p className="font-medium">{ticket.subject}</p>
            <p className="font-mono text-[11px] text-muted-foreground">
              ID: {ticket.accountNumber ?? "—"} · {ticket.user_id}
              {ticket.userEmail ? ` · ${ticket.userEmail}` : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("admin.tickets.metaLine", {
                reference: ticket.reference,
                category: ticket.category,
                priority: ticket.priority,
                status: ticket.status,
              })}
            </p>
            <ol className="mt-3 space-y-2">
              {ticket.messages.map((m) => (
                <li key={m.id} className="rounded-lg bg-muted/40 p-2">
                  <span className="text-xs text-muted-foreground">{m.author_type}</span>
                  <p className="whitespace-pre-wrap">{m.body}</p>
                </li>
              ))}
            </ol>
            {canReply ? (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  value={drafts[ticket.id] ?? ""}
                  onChange={(e) => setDrafts((p) => ({ ...p, [ticket.id]: e.target.value }))}
                  placeholder={t("admin.tickets.replyPlaceholder")}
                  className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
                <Button
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate({ ticketId: ticket.id, resolve: false })}
                >
                  {t("admin.tickets.reply")}
                </Button>
                <Button
                  variant="secondary"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate({ ticketId: ticket.id, resolve: true })}
                >
                  {t("admin.tickets.replyResolve")}
                </Button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function AuditSection() {
  const { t } = useI18n();
  const fetchLogs = useServerFn(listAuditLogs);
  const logs = useQuery({
    queryKey: ["admin", "audit"],
    queryFn: async () => fetchLogs({ data: undefined }),
  });
  return (
    <section>
      <h2 className="text-lg font-medium">{t("admin.audit.title")}</h2>
      <ul className="mt-4 space-y-2 text-sm">
        {(logs.data ?? []).map((log) => (
          <li key={log.id} className="rounded-xl border border-border bg-card/50 px-3 py-2">
            <span className="font-medium">{log.action}</span>{" "}
            <span className="text-xs text-muted-foreground">
              {log.actor_role ?? t("admin.audit.system")} · {log.resource_type ?? "—"} ·{" "}
              {new Date(log.created_at).toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
function AnalyticsSection() {
  const { t } = useI18n();
  const fetchAnalytics = useServerFn(getAdminAnalytics);
  const analytics = useQuery({
    queryKey: ["admin", "analytics"],
    queryFn: async () => fetchAnalytics({ data: undefined }),
    refetchInterval: 60_000,
  });
  const d = analytics.data;
  const peak = Math.max(1, ...(d?.series ?? []).map((b) => Math.abs(b.wagered)));

  return (
    <section>
      <h2 className="text-lg font-medium">{t("admin.analytics.title", { days: d?.days ?? 14 })}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Metric label={t("admin.analytics.wagered")} value={d ? fmt(d.totals.wagered) : "—"} />
        <Metric label={t("admin.analytics.returned")} value={d ? fmt(d.totals.payout) : "—"} />
        <Metric label={t("admin.analytics.ggr")} value={d ? fmt(d.totals.ggr) : "—"} />
        <Metric label={t("admin.analytics.holdPercent")} value={d ? `${d.totals.holdPercent.toFixed(2)}%` : "—"} />
        <Metric label={t("admin.analytics.rounds")} value={d ? d.totals.rounds : "—"} />
        <Metric label={t("admin.analytics.newPlayers")} value={d ? d.totals.newUsers : "—"} />
        <Metric label={t("admin.analytics.depositVolume")} value={d ? fmt(d.totals.depositVolume) : "—"} />
        <Metric label={t("admin.analytics.payoutVolume")} value={d ? fmt(d.totals.withdrawalVolume) : "—"} />
      </div>

      <div className="mt-5 rounded-xl border border-border p-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("admin.analytics.chartTitle")}</p>
        <div className="mt-4 flex h-32 items-end gap-1">
          {(d?.series ?? []).map((bucket) => (
            <div key={bucket.day} className="flex flex-1 flex-col items-center gap-1" title={t("admin.analytics.chartTooltip", { day: bucket.day, wagered: fmt(bucket.wagered), ggr: fmt(bucket.ggr) })}>
              <div className="flex h-28 w-full items-end gap-0.5">
                <div
                  className="flex-1 rounded-t bg-primary/60"
                  style={{ height: `${(Math.abs(bucket.wagered) / peak) * 100}%` }}
                />
                <div
                  className="flex-1 rounded-t bg-success/70"
                  style={{ height: `${(Math.abs(bucket.ggr) / peak) * 100}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">{bucket.day.slice(5)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-border p-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("admin.analytics.topPlayersTitle")}</p>
        {(d?.topPlayers ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{t("admin.analytics.topPlayersEmpty")}</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {(d?.topPlayers ?? []).map((player) => (
              <li key={player.userId} className="flex flex-wrap justify-between gap-2">
                <span className="font-mono text-xs text-muted-foreground">{player.userId.slice(0, 8)}…</span>
                <span className="tabular-nums">
                  {t("admin.analytics.playerLine", { bets: player.bets, wagered: fmt(player.wagered) })}{" "}
                  <span className={player.net >= 0 ? "text-success" : "text-destructive"}>
                    {fmt(player.net)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
    </label>
  );
}

function SettingsSection() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const fetchSettings = useServerFn(getPlatformSettings);
  const save = useServerFn(updatePlatformSettings);
  const [form, setForm] = useState<Record<string, string>>({});
  const [maintenance, setMaintenance] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const settings = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: async () => fetchSettings({ data: undefined }),
  });

  if (settings.data && !loaded) {
    setLoaded(true);
    setForm({
      siteName: settings.data.site_name,
      tagline: settings.data.tagline,
      logoUrl: settings.data.logo_url ?? "",
      supportEmail: settings.data.support_email,
      houseEdgeNote: settings.data.house_edge_note,
    });
    setMaintenance(settings.data.maintenance_mode);
  }

  const mutation = useMutation({
    mutationFn: async () => save({ data: { ...form, maintenanceMode: maintenance } }),
    onSuccess: () => {
      toast.success(t("admin.settings.saved"));
      void queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const set = (key: string) => (value: string) => setForm((p) => ({ ...p, [key]: value }));

  return (
    <section>
      <h2 className="text-lg font-medium">{t("admin.settings.title")}</h2>
      <div className="mt-4 grid gap-3 rounded-xl border border-border p-5 sm:grid-cols-2">
        <Field label={t("admin.settings.siteName")} value={form["siteName"] ?? ""} onChange={set("siteName")} />
        <Field label={t("admin.settings.supportEmail")} value={form["supportEmail"] ?? ""} onChange={set("supportEmail")} />
        <Field label={t("admin.settings.tagline")} value={form["tagline"] ?? ""} onChange={set("tagline")} />
        <Field
          label={t("admin.settings.logoUrl")}
          value={form["logoUrl"] ?? ""}
          onChange={set("logoUrl")}
          placeholder={t("admin.settings.logoUrlPlaceholder")}
        />
        <Field
          label={t("admin.settings.houseEdgeNote")}
          value={form["houseEdgeNote"] ?? ""}
          onChange={set("houseEdgeNote")}
        />
        <label className="flex items-center gap-2 self-end text-sm">
          <input
            type="checkbox"
            checked={maintenance}
            onChange={(e) => setMaintenance(e.target.checked)}
          />
          {t("admin.settings.maintenanceMode")}
        </label>
        <div className="sm:col-span-2">
          <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? t("admin.settings.saving") : t("admin.settings.save")}
          </Button>
        </div>
      </div>
    </section>
  );
}

const STATUSES = ["ACTIVE", "RESTRICTED", "SUSPENDED", "CLOSED"] as const;

function UsersSection({ canManage }: { canManage: boolean }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const search = useServerFn(searchUsers);
  const dossier = useServerFn(getUserDossier);
  const setStatus = useServerFn(setUserStatus);
  const updateProfile = useServerFn(adminUpdateUserProfile);
  const reviewDoc = useServerFn(decideKycDocument);

  const [term, setTerm] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");

  const results = useMutation({
    mutationFn: async () => search({ data: { query: term } }),
    onError: (error: Error) => toast.error(error.message),
  });

  const detail = useQuery({
    queryKey: ["admin", "user", selected],
    queryFn: async () => dossier({ data: { userId: selected! } }),
    enabled: !!selected,
  });

  const statusMutation = useMutation({
    mutationFn: async (status: string) => setStatus({ data: { userId: selected, status, note } }),
    onSuccess: () => {
      toast.success(t("admin.users.statusUpdated"));
      void queryClient.invalidateQueries({ queryKey: ["admin", "user"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const profileMutation = useMutation({
    mutationFn: async () => updateProfile({ data: { userId: selected, ...edit } }),
    onSuccess: () => {
      toast.success(t("admin.users.profileUpdated"));
      void queryClient.invalidateQueries({ queryKey: ["admin", "user"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const docMutation = useMutation({
    mutationFn: async (input: { id: string; decision: "APPROVED" | "REJECTED" }) =>
      reviewDoc({ data: input }),
    onSuccess: () => {
      toast.success(t("admin.users.documentReviewed"));
      void queryClient.invalidateQueries({ queryKey: ["admin", "user"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const d = detail.data;

  return (
    <section>
      <h2 className="text-lg font-medium">{t("admin.users.title")}</h2>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={t("admin.users.searchPlaceholder")}
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <Button disabled={results.isPending} onClick={() => results.mutate()}>
          {t("admin.users.search")}
        </Button>
      </div>

      <ul className="mt-3 space-y-2 text-sm">
        {(results.data ?? []).map((u) => (
          <li key={u.id}>
            <button
              onClick={() => {
                setSelected(u.id);
                setEdit({});
              }}
              className={`w-full rounded-xl border px-3 py-2 text-left ${selected === u.id ? "border-primary" : "border-border"}`}
            >
              <span className="font-medium">{u.email}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                {t("admin.users.metaLine", {
                  name: [u.firstName, u.lastName].filter(Boolean).join(" ") || t("admin.users.noName"),
                  phone: u.phone ?? t("admin.users.noPhone"),
                  status: u.status,
                })}
              </span>
              <span className="block font-mono text-[11px] text-muted-foreground">
                ID: {u.accountNumber ?? "—"} · {u.id}
              </span>
            </button>
            <Link
              to="/admin/users/$userId"
              params={{ userId: u.id }}
              className="mt-1 inline-block text-xs font-semibold text-primary underline-offset-4 hover:underline"
            >
              {t("u360.viewUser")}
            </Link>
          </li>
        ))}
        {results.data && results.data.length === 0 ? (
          <li className="text-sm text-muted-foreground">{t("admin.users.noMatches")}</li>
        ) : null}
      </ul>

      {d ? (
        <div className="mt-5 space-y-4 rounded-xl border border-border p-5 text-sm">
          <div>
            <p className="font-medium">{d.user.email}</p>
            <p className="font-mono text-[11px] text-muted-foreground">
              ID: {d.user.account_number ?? "—"} · {d.user.id}
            </p>
            <p className="text-xs text-muted-foreground">
              {d.user.status} ·{" "}
              {t("admin.users.joined", {
                date: new Date(d.user.created_at).toLocaleDateString(),
                lastLogin: d.user.last_login_at
                  ? new Date(d.user.last_login_at).toLocaleString()
                  : t("admin.users.neverLoggedIn"),
              })}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <Metric label={t("admin.users.statsBets")} value={d.stats.bets} />
            <Metric label={t("admin.users.statsWagered")} value={fmt(d.stats.wagered)} />
            <Metric label={t("admin.users.statsReturned")} value={fmt(d.stats.returned)} />
            <Metric label={t("admin.users.statsNet")} value={fmt(d.stats.net)} />
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("admin.users.walletsTitle")}</p>
            <ul className="mt-2 space-y-1">
              {d.wallets.map((w) => (
                <li key={w.id}>
                  {t("admin.users.walletLine", {
                    currency: w.currency,
                    kind: w.kind,
                    available: fmt(Number(w.available_amount)),
                    locked: fmt(Number(w.locked_amount)),
                    status: w.status,
                  })}
                </li>
              ))}
              {d.wallets.length === 0 ? <li className="text-muted-foreground">{t("admin.users.noWallets")}</li> : null}
            </ul>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("admin.users.recentBetsTitle")}</p>
              <ul className="mt-2 space-y-1">
                {d.bets.slice(0, 8).map((b) => (
                  <li key={b.id}>
                    {t("admin.users.betLine", {
                      amount: fmt(Number(b.amount)),
                      payout: fmt(Number(b.payout_amount ?? 0)),
                      status: b.status,
                    })}
                  </li>
                ))}
                {d.bets.length === 0 ? <li className="text-muted-foreground">{t("admin.users.noBets")}</li> : null}
              </ul>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("admin.users.moneyMovementTitle")}</p>
              <ul className="mt-2 space-y-1">
                {d.deposits.slice(0, 5).map((x) => (
                  <li key={x.id}>
                    {t("admin.users.depositLine", {
                      amount: fmt(Number(x.confirmed_amount ?? x.requested_amount ?? 0)),
                      currency: x.currency,
                      status: x.status,
                    })}
                  </li>
                ))}
                {d.withdrawals.slice(0, 5).map((x) => (
                  <li key={x.id}>
                    {t("admin.users.payoutLine", { amount: fmt(Number(x.amount)), currency: x.currency, status: x.status })}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("admin.users.kycDocumentsTitle")}</p>
            <ul className="mt-2 space-y-2">
              {d.documents.map((doc) => (
                <li key={doc.id} className="flex flex-wrap items-center gap-2">
                  <span>
                    {t("admin.users.docLine", { docType: doc.docType, status: doc.status })}
                  </span>
                  {doc.url ? (
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline"
                    >
                      {t("admin.users.viewFile")}
                    </a>
                  ) : null}
                  <Button
                    size="sm"
                    onClick={() => docMutation.mutate({ id: doc.id, decision: "APPROVED" })}
                  >
                    {t("admin.users.docApprove")}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => docMutation.mutate({ id: doc.id, decision: "REJECTED" })}
                  >
                    {t("admin.users.docReject")}
                  </Button>
                </li>
              ))}
              {d.documents.length === 0 ? (
                <li className="text-muted-foreground">{t("admin.users.noDocuments")}</li>
              ) : null}
            </ul>
          </div>

          {canManage ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label={t("admin.users.firstName")}
                  value={edit["firstName"] ?? d.profile?.first_name ?? ""}
                  onChange={(v) => setEdit((p) => ({ ...p, firstName: v }))}
                />
                <Field
                  label={t("admin.users.lastName")}
                  value={edit["lastName"] ?? d.profile?.last_name ?? ""}
                  onChange={(v) => setEdit((p) => ({ ...p, lastName: v }))}
                />
                <Field
                  label={t("admin.users.phone")}
                  value={edit["phone"] ?? d.profile?.phone ?? ""}
                  onChange={(v) => setEdit((p) => ({ ...p, phone: v }))}
                />
                <Field
                  label={t("admin.users.dateOfBirth")}
                  value={edit["dateOfBirth"] ?? d.user.date_of_birth ?? ""}
                  onChange={(v) => setEdit((p) => ({ ...p, dateOfBirth: v }))}
                  placeholder={t("admin.users.dateOfBirthPlaceholder")}
                />
              </div>
              <Button disabled={profileMutation.isPending} onClick={() => profileMutation.mutate()}>
                {t("admin.users.saveProfile")}
              </Button>

              <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row">
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t("admin.users.reasonPlaceholder")}
                  className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
                {STATUSES.map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={s === "ACTIVE" ? "default" : s === "CLOSED" ? "destructive" : "secondary"}
                    disabled={statusMutation.isPending}
                    onClick={() => statusMutation.mutate(s)}
                  >
                    {s === "ACTIVE" ? t("admin.users.statusUnban") : s === "SUSPENDED" ? t("admin.users.statusBan") : s.toLowerCase()}
                  </Button>
                ))}
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function ManualDepositsSection({ canApprove }: { canApprove: boolean }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const fetchList = useServerFn(listManualDeposits);
  const decide = useServerFn(decideManualDeposit);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const list = useQuery({
    queryKey: ["admin", "manual-deposits"],
    queryFn: async () => fetchList({ data: undefined }),
    refetchInterval: 30_000,
  });

  const mutation = useMutation({
    mutationFn: async (input: { id: string; decision: "APPROVED" | "REJECTED" }) =>
      decide({ data: { ...input, note: notes[input.id] ?? "" } }),
    onSuccess: () => {
      toast.success(t("admin.manualDeposits.processed"));
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <section>
      <h2 className="text-lg font-medium">{t("admin.manualDeposits.title")}</h2>
      <div className="mt-4 space-y-3">
        {list.data?.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("admin.manualDeposits.empty")}</p>
        ) : null}
        {(list.data ?? []).map((r) => (
          <article key={r.id} className="rounded-xl border border-border p-4 text-sm">
            <p className="font-medium">
              {t("admin.manualDeposits.methodLine", {
                amount: fmt(Number(r.amount)),
                currency: r.currency,
                method: r.method.replace(/_/g, " "),
              })}
            </p>
            <p className="text-xs text-muted-foreground break-all">
              {t("admin.manualDeposits.fromLine", {
                sender: r.sender_number,
                reference: r.reference ?? "—",
                user: r.user_id,
              })}
            </p>
            {r.proofUrl ? (
              <a
                href={r.proofUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-primary underline"
              >
                {t("admin.manualDeposits.viewProof")}
              </a>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">{t("admin.manualDeposits.noProof")}</p>
            )}
            {canApprove ? (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  value={notes[r.id] ?? ""}
                  onChange={(e) => setNotes((p) => ({ ...p, [r.id]: e.target.value }))}
                  placeholder={t("admin.manualDeposits.reviewNotePlaceholder")}
                  className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
                <Button
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate({ id: r.id, decision: "APPROVED" })}
                >
                  {t("admin.manualDeposits.approveCredit")}
                </Button>
                <Button
                  variant="destructive"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate({ id: r.id, decision: "REJECTED" })}
                >
                  {t("admin.manualDeposits.reject")}
                </Button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
