import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BadgeCheck,
  Coins,
  LineChart,
  Rocket,
  ShieldAlert,
  TrendingUp,
  Users,
} from "lucide-react";

import { useI18n } from "@/lib/i18n";
import { getAdminAnalytics, getAdminOverview, listAuditLogs } from "@/lib/admin.functions";

function fmt(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <span className="grid size-8 place-items-center rounded-lg bg-secondary/60">
          <Icon className="size-4 text-primary" aria-hidden />
        </span>
      </div>
      <p dir="ltr" className="mt-2 font-display text-2xl font-black tabular-nums rtl:text-end">
        {value}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function Panel({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold">{title}</h2>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Row({ label, value, tone }: { label: string; value: string | number; tone?: "good" | "warn" | "bad" }) {
  const color = tone === "good" ? "text-success" : tone === "bad" ? "text-destructive" : tone === "warn" ? "text-warning" : "";
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/50 py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold tabular-nums ${color}`}>{value}</span>
    </div>
  );
}

export function AdminDashboard({ can }: { can: (permission: string) => boolean }) {
  const { t } = useI18n();
  const fetchOverview = useServerFn(getAdminOverview);
  const fetchAnalytics = useServerFn(getAdminAnalytics);
  const fetchLogs = useServerFn(listAuditLogs);

  const overview = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: async () => fetchOverview({ data: undefined }),
    refetchInterval: 15_000,
  });
  const analytics = useQuery({
    queryKey: ["admin", "analytics"],
    queryFn: async () => fetchAnalytics({ data: undefined }),
    refetchInterval: 60_000,
  });
  const logs = useQuery({
    queryKey: ["admin", "audit"],
    queryFn: async () => fetchLogs({ data: undefined }),
    enabled: can("audit.view"),
  });

  const o = overview.data;
  const a = analytics.data;
  const series = a?.series ?? [];
  const peak = Math.max(1, ...series.map((b) => Math.abs(b.wagered)));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-black tracking-tight">{t("admin.dashboard.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("admin.dashboard.subtitle")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <Kpi label={t("admin.overview.players")} value={o ? fmt(o.users) : "—"} hint={t("admin.dashboard.allTime")} icon={Users} />
        <Kpi label={t("admin.overview.rounds24h")} value={o ? fmt(o.rounds24h) : "—"} hint={t("admin.dashboard.last24h")} icon={Rocket} />
        <Kpi label={t("admin.analytics.depositVolume")} value={a ? fmt(a.totals.depositVolume) : "—"} hint={t("admin.dashboard.period")} icon={ArrowDownToLine} />
        <Kpi label={t("admin.analytics.payoutVolume")} value={a ? fmt(a.totals.withdrawalVolume) : "—"} hint={t("admin.dashboard.period")} icon={ArrowUpFromLine} />
        <Kpi label={t("admin.overview.wagered24h")} value={o ? fmt(o.wagered24h) : "—"} hint={t("admin.dashboard.last24h")} icon={Coins} />
        <Kpi label={t("admin.overview.ggr24h")} value={o ? fmt(o.ggr24h) : "—"} hint={t("admin.dashboard.last24h")} icon={TrendingUp} />
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel title={t("admin.analytics.chartTitle")}>
          {series.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("admin.dashboard.noData")}</p>
          ) : (
            <div className="flex h-40 items-end gap-1">
              {series.map((bucket) => (
                <div key={bucket.day} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex h-32 w-full items-end gap-0.5">
                    <div
                      className="flex-1 rounded-t bg-primary/60"
                      style={{ height: `${(Math.abs(bucket.wagered) / peak) * 100}%` }}
                      title={`${bucket.day} · ${fmt(bucket.wagered)}`}
                    />
                    <div
                      className="flex-1 rounded-t bg-success/70"
                      style={{ height: `${(Math.abs(bucket.ggr) / peak) * 100}%` }}
                      title={`${bucket.day} · ${fmt(bucket.ggr)}`}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{bucket.day.slice(5)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title={t("admin.dashboard.liveStats")}>
          <Row label={t("admin.overview.rounds24h")} value={o ? fmt(o.rounds24h) : "—"} />
          <Row label={t("admin.analytics.holdPercent")} value={a ? `${a.totals.holdPercent.toFixed(2)}%` : "—"} />
          <Row label={t("admin.analytics.newPlayers")} value={a ? fmt(a.totals.newUsers) : "—"} />
          <Row label={t("admin.overview.ledgerDrift")} value={o ? o.driftedWallets : "—"} tone={o && o.driftedWallets > 0 ? "bad" : "good"} />
        </Panel>
      </div>

      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
        <Panel
          title={t("admin.dashboard.pendingVerifications")}
          action={
            <Link to="/admin" search={{ section: "kyc" }} className="text-[11px] font-semibold text-primary">
              {t("admin.dashboard.viewAll")}
            </Link>
          }
        >
          <p className="flex items-center gap-2 font-display text-3xl font-black tabular-nums">
            <BadgeCheck className="size-5 text-primary" aria-hidden />
            {o ? o.pendingKyc : "—"}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">{t("admin.dashboard.awaitingReview")}</p>
        </Panel>

        <Panel
          title={t("admin.overview.pendingPayouts")}
          action={
            <Link to="/admin" search={{ section: "withdrawals" }} className="text-[11px] font-semibold text-primary">
              {t("admin.dashboard.viewAll")}
            </Link>
          }
        >
          <p className="font-display text-3xl font-black tabular-nums">{o ? o.pendingWithdrawals : "—"}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {t("admin.overview.payoutValue")}: {o ? fmt(o.pendingWithdrawalValue) : "—"}
          </p>
        </Panel>

        <Panel
          title={t("admin.dashboard.riskAlerts")}
          action={
            <Link to="/admin" search={{ section: "risk" }} className="text-[11px] font-semibold text-primary">
              {t("admin.dashboard.viewAll")}
            </Link>
          }
        >
          <p className="flex items-center gap-2 font-display text-3xl font-black tabular-nums">
            <ShieldAlert className="size-5 text-destructive" aria-hidden />
            {o ? o.openRiskEvents : "—"}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">{t("admin.dashboard.openEvents")}</p>
        </Panel>

        <Panel title={t("admin.dashboard.quickActions")}>
          <div className="grid gap-2">
            <Link
              to="/admin"
              search={{ section: "users" }}
              className="rounded-lg border border-border px-3 py-2 text-xs font-semibold transition-colors hover:bg-secondary/60"
            >
              {t("admin.nav.users")}
            </Link>
            <Link
              to="/admin"
              search={{ section: "deposits" }}
              className="rounded-lg border border-border px-3 py-2 text-xs font-semibold transition-colors hover:bg-secondary/60"
            >
              {t("admin.nav.deposits")}
            </Link>
            <Link
              to="/admin"
              search={{ section: "settings" }}
              className="rounded-lg border border-border px-3 py-2 text-xs font-semibold transition-colors hover:bg-secondary/60"
            >
              {t("admin.nav.settings")}
            </Link>
          </div>
        </Panel>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel
          title={t("admin.analytics.topPlayersTitle")}
          action={
            <Link to="/admin" search={{ section: "analytics" }} className="text-[11px] font-semibold text-primary">
              {t("admin.dashboard.viewAll")}
            </Link>
          }
        >
          {(a?.topPlayers ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("admin.analytics.topPlayersEmpty")}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-1 text-start font-semibold">{t("admin.dashboard.user")}</th>
                  <th className="py-1 text-end font-semibold">{t("admin.analytics.wagered")}</th>
                  <th className="py-1 text-end font-semibold">{t("admin.dashboard.net")}</th>
                </tr>
              </thead>
              <tbody>
                {(a?.topPlayers ?? []).map((p) => (
                  <tr key={p.userId} className="border-t border-border/50">
                    <td className="py-1.5 font-mono text-xs text-muted-foreground">{p.userId.slice(0, 8)}…</td>
                    <td className="py-1.5 text-end tabular-nums">{fmt(p.wagered)}</td>
                    <td className={`py-1.5 text-end tabular-nums ${p.net >= 0 ? "text-success" : "text-destructive"}`}>
                      {fmt(p.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel
          title={t("admin.dashboard.recentActivity")}
          action={
            can("audit.view") ? (
              <Link to="/admin" search={{ section: "audit" }} className="text-[11px] font-semibold text-primary">
                {t("admin.dashboard.viewAll")}
              </Link>
            ) : undefined
          }
        >
          {(logs.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("admin.dashboard.noActivity")}</p>
          ) : (
            <ul className="space-y-2">
              {(logs.data ?? []).slice(0, 8).map((log) => (
                <li key={log.id} className="flex items-start justify-between gap-3 text-xs">
                  <span className="font-semibold">{log.action}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {new Date(log.created_at).toLocaleTimeString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title={t("admin.dashboard.systemHealth")}>
          <Row label={t("admin.dashboard.database")} value={t("admin.system.operational")} tone="good" />
          <Row label={t("admin.dashboard.gameEngine")} value={o && o.rounds24h > 0 ? t("admin.system.operational") : t("admin.dashboard.idle")} tone="good" />
          <Row label={t("admin.dashboard.ledger")} value={o && o.driftedWallets === 0 ? t("admin.dashboard.balanced") : t("admin.dashboard.driftDetected")} tone={o && o.driftedWallets === 0 ? "good" : "bad"} />
          <Row label={t("admin.overview.openTickets")} value={o ? o.openTickets : "—"} />
        </Panel>
        <Panel
          title={t("admin.dashboard.opsSummary")}
          action={<LineChart className="size-4 text-muted-foreground" aria-hidden />}
        >
          <Row label={t("admin.analytics.rounds")} value={a ? fmt(a.totals.rounds) : "—"} />
          <Row label={t("admin.analytics.wagered")} value={a ? fmt(a.totals.wagered) : "—"} />
          <Row label={t("admin.analytics.returned")} value={a ? fmt(a.totals.payout) : "—"} />
          <Row label={t("admin.analytics.ggr")} value={a ? fmt(a.totals.ggr) : "—"} tone={a && a.totals.ggr >= 0 ? "good" : "bad"} />
        </Panel>
      </div>
    </div>
  );
}
