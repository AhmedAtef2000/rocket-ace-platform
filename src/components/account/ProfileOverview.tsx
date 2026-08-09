import { Link } from "@tanstack/react-router";
import { BadgeCheck, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

type Overview = {
  user: {
    email: string | null;
    account_number: string | number | null;
    last_login_at: string | null;
    mfa_enabled: boolean | null;
  } | null;
  profile: { first_name: string | null; last_name: string | null } | null;
  balance: { currency: string; available: number; locked: number };
  stats: {
    lifetimeBets: number;
    highestMultiplier: number;
    totalProfit: number;
    totalStaked: number;
  };
  kyc: { status: string; reviewedAt: string | null };
};

function money(currency: string, amount: number) {
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));
  return `${amount < 0 ? "-" : ""}$${formatted} ${currency}`;
}

function relativeTime(iso: string | null, never: string) {
  if (!iso) return never;
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.round(diff / 60000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

export function ProfileOverview({ data }: { data: Overview | null }) {
  const { t } = useI18n();

  const name =
    [data?.profile?.first_name, data?.profile?.last_name].filter(Boolean).join(" ") ||
    data?.user?.email?.split("@")[0] ||
    "—";
  const initials = name.slice(0, 2).toUpperCase();
  const accountId = data?.user?.account_number ? `AB-${data.user.account_number}` : "—";
  const verified = data?.kyc.status === "APPROVED";
  const profit = data?.stats.totalProfit ?? 0;

  return (
    <div className="mt-6 space-y-6">
      {/* Hero summary */}
      <section className="rounded-3xl border border-primary/40 bg-card/70 p-6 shadow-[0_0_40px_-12px_hsl(var(--primary)/0.6)] ring-1 ring-primary/10">
        <h2 className="font-display text-xl font-bold">{t("acct.profile.summary")}</h2>
        <div className="mt-5 grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-center">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="flex size-24 items-center justify-center rounded-full bg-primary/15 text-2xl font-bold text-primary ring-2 ring-primary/40">
                {initials}
              </div>
              <span className="absolute bottom-1 end-1 size-5 rounded-full border-2 border-card bg-primary" />
            </div>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-muted-foreground">{t("acct.profile.name")}</dt>
                <dd className="text-base font-semibold text-foreground">{name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("acct.email")}</dt>
                <dd className="break-all text-foreground">{data?.user?.email ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("acct.profile.accountId")}</dt>
                <dd className="font-mono text-foreground" dir="ltr">
                  {accountId}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-primary/30 bg-background/60 p-5">
            <p className="text-sm text-muted-foreground">{t("acct.profile.balance")}</p>
            <p className="mt-1 font-display text-3xl font-extrabold tracking-tight" dir="ltr">
              {money(data?.balance.currency ?? "USD", data?.balance.available ?? 0)}
            </p>
            {data && data.balance.locked > 0 ? (
              <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                {t("acct.profile.pendingBalance")}: {money(data.balance.currency, data.balance.locked)}
              </p>
            ) : null}
            <div className="mt-4 flex gap-3">
              <Button asChild className="flex-1">
                <Link to="/wallet">{t("acct.profile.deposit")}</Link>
              </Button>
              <Button asChild variant="secondary" className="flex-1">
                <Link to="/wallet">{t("acct.profile.withdraw")}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stat cards */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card/60 p-5">
          <h3 className="text-sm font-semibold">{t("acct.profile.bettingStats")}</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <Row
              label={t("acct.profile.lifetimeBets")}
              value={(data?.stats.lifetimeBets ?? 0).toLocaleString("en-US")}
            />
            <Row
              label={t("acct.profile.highestMultiplier")}
              value={`${(data?.stats.highestMultiplier ?? 0).toFixed(2)}x`}
            />
            <Row
              label={t("acct.profile.totalProfit")}
              value={money(data?.balance.currency ?? "USD", profit)}
              accent={profit >= 0}
            />
          </dl>
        </section>

        <section className="rounded-2xl border border-border bg-card/60 p-5">
          <h3 className="text-sm font-semibold">{t("acct.profile.verificationStatus")}</h3>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("acct.profile.verified")}</span>
            <span
              className={`flex items-center gap-1.5 font-medium ${verified ? "text-primary" : "text-muted-foreground"}`}
            >
              <BadgeCheck className="size-4" />
              {verified ? t("acct.profile.verified") : t("acct.profile.notVerified")}
            </span>
          </div>
          <h3 className="mt-5 text-sm font-semibold">{t("acct.profile.security")}</h3>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <ShieldCheck className="size-4" />
              {t("acct.profile.lastSignIn")}
            </span>
            <span className="text-foreground" dir="ltr">
              {relativeTime(data?.user?.last_login_at ?? null, t("acct.profile.never"))}
            </span>
          </div>
        </section>
      </div>

      {/* Popular games */}
      <section className="rounded-2xl border border-border bg-card/60 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{t("acct.profile.popularGames")}</h3>
          <Button asChild size="sm" variant="ghost">
            <Link to="/game">{t("acct.profile.viewAll")}</Link>
          </Button>
        </div>
        <div className="mt-4 flex snap-x gap-3 overflow-x-auto pb-2">
          {GAMES.map((game) => {
            const Icon = game.icon;
            const tile = (
              <div
                className={`relative flex size-full min-h-28 w-36 shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-xl border border-border bg-gradient-to-b ${game.tint} to-background/40 p-4 transition-colors hover:border-primary/50`}
              >
                {game.badge ? (
                  <span className="absolute end-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                    {game.badge}
                  </span>
                ) : null}
                <Icon className="size-7 text-primary" />
                <span className="text-sm font-medium">{game.label}</span>
              </div>
            );
            return "to" in game && game.to ? (
              <Link key={game.key} to={game.to} className="shrink-0">
                {tile}
              </Link>
            ) : (
              <div key={game.key} className="shrink-0 opacity-70">
                {tile}
              </div>
            );
          })}
          <div className="hidden">
            <Gem className="size-4" />
          </div>
        </div>
      </section>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={accent ? "font-medium text-primary" : "font-medium text-foreground"} dir="ltr">
        {value}
      </dd>
    </div>
  );
}