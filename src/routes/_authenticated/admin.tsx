import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { AccountNav } from "@/components/account/AccountNav";
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

const title = "Back office — Rocket Flight";
const description =
  "Operator console for withdrawal approvals, KYC decisions, risk events, support tickets and the audit trail.";

export const Route = createFileRoute("/_authenticated/admin")({
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
      toast.success("Super admin access granted");
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const identity = session.data?.identity ?? null;
  const can = (permission: string) => identity?.permissions.includes(permission) ?? false;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-8">
      <h1 className="text-2xl font-semibold tracking-tight">Back office</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {identity
          ? `Signed in as ${identity.roleKey.replace(/_/g, " ").toLowerCase()} · ${identity.permissions.length} permissions`
          : "Staff-only console. Every action here is written to the audit trail."}
      </p>
      <AccountNav />

      {session.isLoading ? <p className="mt-8 text-sm text-muted-foreground">Loading…</p> : null}

      {!identity && session.data ? (
        <section className="mt-8 rounded-xl border border-border p-5">
          <h2 className="text-lg font-medium">No back-office access</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This account has no operator role.{" "}
            {session.data.bootstrapAvailable
              ? "No administrator exists yet, so this account can claim the first Super Admin role. The claim closes permanently once used."
              : "Ask an existing Super Admin to grant you a role."}
          </p>
          {session.data.bootstrapAvailable ? (
            <Button
              className="mt-4"
              disabled={claimMutation.isPending}
              onClick={() => claimMutation.mutate()}
            >
              Claim Super Admin
            </Button>
          ) : null}
        </section>
      ) : null}

      {identity ? (
        <div className="mt-8 space-y-10">
          {can("analytics.view") ? <OverviewSection /> : null}
          {can("analytics.view") ? <AnalyticsSection /> : null}
          {can("withdrawal.review") ? <WithdrawalsSection canApprove={can("withdrawal.approve")} /> : null}
          {can("kyc.view") ? <KycSection canDecide={can("kyc.decide")} /> : null}
          {can("risk.view") ? <RiskSection canResolve={can("risk.resolve")} /> : null}
          {can("support.view") ? <TicketsSection canReply={can("support.reply")} /> : null}
          {can("audit.view") ? <AuditSection /> : null}
        </div>
      ) : null}
    </main>
  );
}

function OverviewSection() {
  const fetchOverview = useServerFn(getAdminOverview);
  const overview = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: async () => fetchOverview({ data: undefined }),
    refetchInterval: 15_000,
  });
  const d = overview.data;
  return (
    <section>
      <h2 className="text-lg font-medium">Overview</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Metric label="Players" value={d ? d.users : "—"} />
        <Metric label="Rounds 24h" value={d ? d.rounds24h : "—"} />
        <Metric label="Wagered 24h" value={d ? fmt(d.wagered24h) : "—"} />
        <Metric label="GGR 24h" value={d ? fmt(d.ggr24h) : "—"} />
        <Metric label="Pending payouts" value={d ? d.pendingWithdrawals : "—"} />
        <Metric label="Payout value" value={d ? fmt(d.pendingWithdrawalValue) : "—"} />
        <Metric label="Open risk events" value={d ? d.openRiskEvents : "—"} />
        <Metric label="Open tickets" value={d ? d.openTickets : "—"} />
        <Metric label="KYC queue" value={d ? d.pendingKyc : "—"} />
        <Metric label="Ledger drift" value={d ? d.driftedWallets : "—"} />
      </div>
    </section>
  );
}

function WithdrawalsSection({ canApprove }: { canApprove: boolean }) {
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
      toast.success("Decision recorded");
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <section>
      <h2 className="text-lg font-medium">Withdrawal approvals</h2>
      <div className="mt-4 space-y-3">
        {list.data?.length === 0 ? (
          <p className="text-sm text-muted-foreground">Queue is clear.</p>
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
                  {w.status} · risk {w.risk_status} · approvals {w.approvals_count}/
                  {w.approvals_required}
                </p>
              </div>
            </div>
            {canApprove ? (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  value={notes[w.id] ?? ""}
                  onChange={(e) => setNotes((p) => ({ ...p, [w.id]: e.target.value }))}
                  placeholder="Decision note"
                  className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
                <Button
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate({ id: w.id, decision: "APPROVE" })}
                >
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate({ id: w.id, decision: "REJECT" })}
                >
                  Reject
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
      toast.success("Case updated");
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <section>
      <h2 className="text-lg font-medium">KYC queue</h2>
      <div className="mt-4 space-y-3">
        {list.data?.length === 0 ? (
          <p className="text-sm text-muted-foreground">No cases awaiting review.</p>
        ) : null}
        {(list.data ?? []).map((c) => (
          <article key={c.id} className="rounded-xl border border-border p-4 text-sm">
            <p className="font-medium">
              {c.status} · risk {c.risk_level}
            </p>
            <p className="text-xs text-muted-foreground break-all">User {c.user_id}</p>
            {c.rejection_reason ? (
              <p className="mt-1 text-xs text-muted-foreground">{c.rejection_reason}</p>
            ) : null}
            {canDecide ? (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  value={notes[c.id] ?? ""}
                  onChange={(e) => setNotes((p) => ({ ...p, [c.id]: e.target.value }))}
                  placeholder="Reviewer note"
                  className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
                <Button
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate({ id: c.id, decision: "APPROVED" })}
                >
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate({ id: c.id, decision: "REJECTED" })}
                >
                  Reject
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
      toast.success(`Scanned ${result.scanned} accounts · ${result.flagged} flagged`);
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const mutation = useMutation({
    mutationFn: async (input: { id: string; status: "RESOLVED" | "DISMISSED" | "ESCALATED" }) =>
      resolve({ data: input }),
    onSuccess: () => {
      toast.success("Risk event updated");
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-medium">Risk & fraud</h2>
        <Button
          variant="secondary"
          disabled={scanMutation.isPending}
          onClick={() => scanMutation.mutate()}
        >
          {scanMutation.isPending ? "Scanning…" : "Run risk scan"}
        </Button>
      </div>
      <div className="mt-4 space-y-3">
        {list.data?.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open risk events.</p>
        ) : null}
        {(list.data ?? []).map((e) => (
          <article key={e.id} className="rounded-xl border border-border p-4 text-sm">
            <p className="font-medium">
              {e.event_type} · score {e.risk_score} · {e.severity}
            </p>
            <p className="text-xs text-muted-foreground break-all">
              {e.source} · user {e.user_id ?? "—"}
            </p>
            {e.description ? <p className="mt-1">{e.description}</p> : null}
            {canResolve ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => mutation.mutate({ id: e.id, status: "RESOLVED" })}
                >
                  Resolve
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => mutation.mutate({ id: e.id, status: "ESCALATED" })}
                >
                  Escalate
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => mutation.mutate({ id: e.id, status: "DISMISSED" })}
                >
                  Dismiss
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
      toast.success("Reply sent");
      setDrafts((p) => ({ ...p, [input.ticketId]: "" }));
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <section>
      <h2 className="text-lg font-medium">Support queue</h2>
      <div className="mt-4 space-y-3">
        {list.data?.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open tickets.</p>
        ) : null}
        {(list.data ?? []).map((t) => (
          <article key={t.id} className="rounded-xl border border-border p-4 text-sm">
            <p className="font-medium">{t.subject}</p>
            <p className="text-xs text-muted-foreground">
              {t.reference} · {t.category} · {t.priority} · {t.status}
            </p>
            <ol className="mt-3 space-y-2">
              {t.messages.map((m) => (
                <li key={m.id} className="rounded-lg bg-muted/40 p-2">
                  <span className="text-xs text-muted-foreground">{m.author_type}</span>
                  <p className="whitespace-pre-wrap">{m.body}</p>
                </li>
              ))}
            </ol>
            {canReply ? (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  value={drafts[t.id] ?? ""}
                  onChange={(e) => setDrafts((p) => ({ ...p, [t.id]: e.target.value }))}
                  placeholder="Reply to player"
                  className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
                <Button
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate({ ticketId: t.id, resolve: false })}
                >
                  Reply
                </Button>
                <Button
                  variant="secondary"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate({ ticketId: t.id, resolve: true })}
                >
                  Reply & resolve
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
  const fetchLogs = useServerFn(listAuditLogs);
  const logs = useQuery({
    queryKey: ["admin", "audit"],
    queryFn: async () => fetchLogs({ data: undefined }),
  });
  return (
    <section>
      <h2 className="text-lg font-medium">Audit trail</h2>
      <ul className="mt-4 space-y-2 text-sm">
        {(logs.data ?? []).map((log) => (
          <li key={log.id} className="rounded-lg border border-border px-3 py-2">
            <span className="font-medium">{log.action}</span>{" "}
            <span className="text-xs text-muted-foreground">
              {log.actor_role ?? "SYSTEM"} · {log.resource_type ?? "—"} ·{" "}
              {new Date(log.created_at).toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
function AnalyticsSection() {
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
      <h2 className="text-lg font-medium">Analytics · last {d?.days ?? 14} days</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Metric label="Wagered" value={d ? fmt(d.totals.wagered) : "—"} />
        <Metric label="Returned" value={d ? fmt(d.totals.payout) : "—"} />
        <Metric label="GGR" value={d ? fmt(d.totals.ggr) : "—"} />
        <Metric label="Hold %" value={d ? `${d.totals.holdPercent.toFixed(2)}%` : "—"} />
        <Metric label="Rounds" value={d ? d.totals.rounds : "—"} />
        <Metric label="New players" value={d ? d.totals.newUsers : "—"} />
        <Metric label="Deposit volume" value={d ? fmt(d.totals.depositVolume) : "—"} />
        <Metric label="Payout volume" value={d ? fmt(d.totals.withdrawalVolume) : "—"} />
      </div>

      <div className="mt-5 rounded-xl border border-border p-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Daily wagered vs GGR</p>
        <div className="mt-4 flex h-32 items-end gap-1">
          {(d?.series ?? []).map((bucket) => (
            <div key={bucket.day} className="flex flex-1 flex-col items-center gap-1" title={`${bucket.day}: wagered ${fmt(bucket.wagered)} · GGR ${fmt(bucket.ggr)}`}>
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
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Top players by wagered</p>
        {(d?.topPlayers ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No betting activity in this window.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {(d?.topPlayers ?? []).map((player) => (
              <li key={player.userId} className="flex flex-wrap justify-between gap-2">
                <span className="font-mono text-xs text-muted-foreground">{player.userId.slice(0, 8)}…</span>
                <span className="tabular-nums">
                  {player.bets} bets · wagered {fmt(player.wagered)} · net{" "}
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
