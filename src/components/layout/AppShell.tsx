import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BadgeCheck,
  Crown,
  LayoutGrid,
  LifeBuoy,
  LogOut,
  MailOpen,
  Menu,
  Receipt,
  Rocket,
  Settings,
  ShieldCheck,
  UserRound,
  Wallet,
  X,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { InboxMenu } from "@/components/layout/InboxMenu";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { CurrencySwitcher } from "@/components/layout/CurrencySwitcher";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";
import { getAdminSession } from "@/lib/admin.functions";
import { getWallets } from "@/lib/wallet.functions";

/** Primary product navigation, rendered in both the top bar and the rail. */
export const topNav = [
  { to: "/", label: "Home" },
  { to: "/game", label: "Crash" },
  { to: "/wallet", label: "Wallet" },
  { to: "/payments", label: "Transactions" },
  { to: "/fairness", label: "Fairness" },
  { to: "/support", label: "Support" },
] as const;

const railItems = [
  { to: "/account", label: "Overview", icon: LayoutGrid },
  { to: "/game", label: "Crash", icon: Rocket },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/payments", label: "Transactions", icon: Receipt },
  { to: "/profile", label: "Profile", icon: UserRound },
  { to: "/compliance", label: "Verification", icon: BadgeCheck },
  { to: "/notifications", label: "Messages", icon: MailOpen },
  { to: "/security", label: "Settings", icon: Settings },
  { to: "/fairness", label: "VIP & Fairness", icon: Crown },
  { to: "/support", label: "Help & Support", icon: LifeBuoy },
] as const;

export function BrandMark() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-thrust shadow-orbit">
        <Rocket className="size-5 text-primary-foreground" aria-hidden />
      </span>
      <span className="font-display text-lg font-black tracking-tight">
        ASTRO<span className="text-primary">BET</span>
      </span>
    </Link>
  );
}

function SideNav({ isAdmin, onNavigate }: { isAdmin: boolean; onNavigate?: () => void }) {
  const items = [
    ...railItems,
    ...(isAdmin ? ([{ to: "/admin", label: "Back office", icon: ShieldCheck }] as const) : []),
  ];
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Sections">
      {items.map((item) => (
        <Link
          key={item.label}
          to={item.to}
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-text-secondary transition-colors duration-200 hover:bg-secondary hover:text-foreground"
          activeProps={{
            className:
              "flex items-center gap-3 rounded-xl bg-primary/12 px-3 py-2.5 text-sm font-semibold text-foreground [&_svg]:text-primary",
          }}
          activeOptions={{ exact: false }}
        >
          <item.icon className="size-5 shrink-0" aria-hidden />
          <span className="truncate">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}

function BalanceCard({ balance, publicView }: { balance: number; publicView: boolean }) {
  const { formatMoney, t } = useI18n();
  return (
    <div className="panel-inset p-3">
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {t("common.balance")}
      </p>
      <p className="mt-1 font-display text-2xl font-black tabular-nums text-primary">
        {publicView ? formatMoney(0) : formatMoney(balance)}
      </p>
      {publicView ? (
        <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
          Sign in to fund your account
        </p>
      ) : null}
      <div className="mt-3 grid gap-2">
        <Link
          to={publicView ? "/auth" : "/payments"}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-thrust px-3 py-2 text-xs font-bold text-primary-foreground shadow-orbit transition-transform hover:scale-[1.02]"
        >
          <ArrowDownToLine className="size-4" aria-hidden />
          Deposit
        </Link>
        <Link
          to={publicView ? "/auth" : "/wallet"}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-secondary/50 px-3 py-2 text-xs font-bold transition-colors hover:bg-secondary"
        >
          <ArrowUpFromLine className="size-4" aria-hidden />
          Withdraw
        </Link>
      </div>
    </div>
  );
}

/**
 * Single chrome shared by every screen: brand header with top nav, language +
 * currency selectors, deposit CTA and account cluster, plus the left rail.
 */
export function AppShell({
  children,
  publicView = false,
}: {
  children: ReactNode;
  publicView?: boolean;
}) {
  const { t, formatMoney } = useI18n();
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const fetchAdminSession = useServerFn(getAdminSession);
  const fetchWallets = useServerFn(getWallets);

  const admin = useQuery({
    queryKey: ["admin", "session"],
    queryFn: async () => fetchAdminSession({ data: undefined }),
    staleTime: 5 * 60 * 1000,
    retry: false,
    enabled: !publicView,
  });
  const wallets = useQuery({
    queryKey: ["wallet", "summary"],
    queryFn: async () => fetchWallets({ data: undefined }),
    retry: false,
    enabled: !publicView,
  });
  const isAdmin = Boolean(admin.data?.identity);
  // Show the wallet the player actually plays with (highest available balance).
  const balance = (wallets.data?.wallets ?? []).reduce(
    (top, w) => Math.max(top, Number(w.available_amount ?? 0)),
    0,
  );
  const username = user?.email ? user.email.split("@")[0] : null;

  return (
    <div
      className="relative min-h-screen bg-background bg-fixed bg-no-repeat text-foreground"
      style={{ backgroundImage: "var(--surface-glow)" }}
    >
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto grid w-full max-w-[1600px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              className="grid size-9 shrink-0 place-items-center rounded-xl border border-border lg:hidden"
            >
              <Menu className="size-4" aria-hidden />
            </button>
            <BrandMark />
          </div>

          <nav className="hidden min-w-0 items-center gap-1 xl:flex" aria-label="Primary">
            {topNav.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className="nav-pill hover:text-foreground"
                activeProps={{ className: "nav-pill nav-pill-active" }}
                activeOptions={{ exact: item.to === "/" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center justify-end gap-2">
            <span className="hidden md:block">
              <LanguageSwitcher />
            </span>
            <span className="hidden md:block">
              <CurrencySwitcher />
            </span>
            {publicView && !username ? (
              <>
                <Link
                  to="/auth"
                  search={{ mode: "signin" }}
                  className="rounded-xl border border-border px-3 py-2 text-xs font-bold transition-colors hover:bg-secondary"
                >
                  {t("nav.signIn")}
                </Link>
                <Link
                  to="/auth"
                  search={{ mode: "signup" }}
                  className="rounded-xl bg-thrust px-3 py-2 text-xs font-bold text-primary-foreground shadow-orbit transition-transform hover:scale-[1.03]"
                >
                  {t("nav.register")}
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/payments"
                  className="rounded-xl bg-thrust px-4 py-2 text-xs font-bold text-primary-foreground shadow-orbit transition-transform hover:scale-[1.03]"
                >
                  Deposit
                </Link>
                <InboxMenu />
                <div className="hidden items-center gap-2 rounded-xl border border-border px-2.5 py-1.5 sm:flex">
                  <span className="grid size-7 place-items-center rounded-lg bg-secondary text-[11px] font-black uppercase">
                    {(username ?? "A").slice(0, 2)}
                  </span>
                  <span className="leading-tight">
                    <span className="block max-w-28 truncate text-[11px] font-bold">
                      {username ?? "Player"}
                    </span>
                    <span className="block text-[11px] font-semibold tabular-nums text-primary">
                      {formatMoney(balance)}
                    </span>
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1600px] gap-4 px-3 py-4 sm:px-4">
        <aside className="sticky top-[72px] hidden h-[calc(100vh-88px)] w-60 shrink-0 flex-col justify-between overflow-y-auto panel p-3 lg:flex">
          <div className="space-y-3">
            <BalanceCard balance={balance} publicView={publicView} />
            <SideNav isAdmin={isAdmin} />
          </div>
          {publicView && !username ? null : (
            <button
              type="button"
              onClick={() => void supabase.auth.signOut()}
              className="mt-3 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
            >
              <LogOut className="size-4" aria-hidden />
              {t("nav.signOut")}
            </button>
          )}
        </aside>

        <div className="min-w-0 flex-1 animate-page-in">{children}</div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-background/80 backdrop-blur"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 start-0 w-72 overflow-y-auto panel p-3">
            <div className="mb-3 flex items-center justify-between">
              <BrandMark />
              <button type="button" aria-label="Close menu" onClick={() => setOpen(false)}>
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <div className="mb-3">
              <BalanceCard balance={balance} publicView={publicView} />
            </div>
            <SideNav isAdmin={isAdmin} onNavigate={() => setOpen(false)} />
            <div className="mt-3 flex items-center gap-2">
              <LanguageSwitcher />
              <CurrencySwitcher />
            </div>
            {publicView && !username ? null : (
              <button
                type="button"
                onClick={() => void supabase.auth.signOut()}
                className="mt-3 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
              >
                <LogOut className="size-4" aria-hidden />
                {t("nav.signOut")}
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Centered chrome for the signed-out auth screens. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-background px-4 py-12 text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: "var(--surface-glow)" }}
      />
      <div className="relative w-full max-w-md rounded-3xl border border-border bg-card/70 p-6 shadow-orbit backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-thrust">
              <Rocket className="size-5 text-primary-foreground" aria-hidden />
            </span>
            <span className="font-display text-lg font-extrabold tracking-tight">AstroBet</span>
          </Link>
          <LanguageSwitcher />
        </div>
        {children}
      </div>
    </main>
  );
}
