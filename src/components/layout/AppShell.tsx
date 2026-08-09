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
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";
import { getAdminSession } from "@/lib/admin.functions";
import { getWallets } from "@/lib/wallet.functions";
import { getAccount } from "@/lib/account.functions";

/** Hover/click account card in the header: photo, name, balance and account ID. */
function AccountMenu({ username, balance }: { username: string | null; balance: number }) {
  const { t, formatMoney } = useI18n();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const fetchAccount = useServerFn(getAccount);
  const account = useQuery({
    queryKey: ["account", "header"],
    queryFn: async () => fetchAccount({ data: undefined }),
    retry: false,
    staleTime: 60_000,
  });

  const photo =
    (user?.user_metadata?.["avatar_url"] as string | undefined) ??
    (user?.user_metadata?.["picture"] as string | undefined) ??
    null;
  const accountNumber = account.data?.user?.account_number ?? null;

  return (
    <div
      className="relative hidden sm:block"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-xl border border-border px-2.5 py-1.5 transition-colors hover:bg-secondary/60"
      >
        {photo ? (
          <img src={photo} alt="" className="size-7 rounded-lg object-cover" />
        ) : (
          <span className="grid size-7 place-items-center rounded-lg bg-secondary text-[11px] font-black uppercase">
            {(username ?? "A").slice(0, 2)}
          </span>
        )}
        <span className="leading-tight">
          <span className="block max-w-28 truncate text-start text-[11px] font-bold">
            {username ?? t("nav.player")}
          </span>
          <span
            dir="ltr"
            className="block text-[11px] font-semibold tabular-nums text-primary rtl:text-end"
          >
            {formatMoney(balance)}
          </span>
        </span>
      </button>

      {open ? (
        <div className="absolute end-0 top-full z-50 w-64 pt-2">
          <div className="panel p-3 shadow-orbit">
            <div className="flex items-center gap-3">
              {photo ? (
                <img src={photo} alt="" className="size-11 rounded-xl object-cover" />
              ) : (
                <span className="grid size-11 place-items-center rounded-xl bg-secondary text-sm font-black uppercase">
                  {(username ?? "A").slice(0, 2)}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{username ?? t("nav.player")}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {account.data?.user?.email ?? ""}
                </p>
              </div>
            </div>

            <div className="panel-inset mt-3 space-y-2 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {t("common.balance")}
                </span>
                <span dir="ltr" className="font-mono text-sm tabular-nums text-primary">
                  {formatMoney(balance)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {t("ui.accountId")}
                </span>
                <span dir="ltr" className="font-mono text-xs tabular-nums">
                  {accountNumber ?? "—"}
                </span>
              </div>
            </div>

            <div className="mt-3 grid gap-1">
              <Link
                to="/profile"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-semibold transition-colors hover:bg-secondary/60"
              >
                <UserRound className="size-4" aria-hidden />
                {t("nav.profile")}
              </Link>
              <Link
                to="/wallet"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-semibold transition-colors hover:bg-secondary/60"
              >
                <Wallet className="size-4" aria-hidden />
                {t("nav.wallet")}
              </Link>
              <button
                type="button"
                onClick={() => void supabase.auth.signOut()}
                className="flex items-center gap-2 rounded-lg px-2 py-2 text-start text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
              >
                <LogOut className="size-4" aria-hidden />
                {t("nav.signOut")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Primary product navigation, rendered in both the top bar and the rail. */
export const topNav = [
  { to: "/", label: "Home", key: "nav.home" },
  { to: "/game", label: "Crash", key: "nav.crash" },
  { to: "/wallet", label: "Wallet", key: "nav.wallet" },
  { to: "/fairness", label: "Fairness", key: "nav.fairness" },
  { to: "/support", label: "Support", key: "nav.support" },
] as const satisfies readonly { to: string; label: string; key: TranslationKey }[];

const railItems = [
  { to: "/account", label: "Overview", key: "nav.overview", icon: LayoutGrid },
  { to: "/game", label: "Crash", key: "nav.crash", icon: Rocket },
  { to: "/wallet", label: "Wallet", key: "nav.wallet", icon: Wallet },
  { to: "/profile", label: "Profile", key: "nav.profile", icon: UserRound },
  { to: "/compliance", label: "Verification", key: "nav.verification", icon: BadgeCheck },
  { to: "/notifications", label: "Messages", key: "nav.messages", icon: MailOpen },
  { to: "/security", label: "Settings", key: "nav.settings", icon: Settings },
  { to: "/fairness", label: "VIP & Fairness", key: "nav.vipFairness", icon: Crown },
  { to: "/support", label: "Help & Support", key: "nav.helpSupport", icon: LifeBuoy },
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

/** Sections hidden from signed-out visitors until they log in. */
const gatedLabels = [
  "Crash",
  "Wallet",
  "Profile",
  "Verification",
  "Messages",
  "Settings",
  "VIP & Fairness",
];

/** Top-bar links hidden from signed-out visitors until they log in. */
const gatedTopNavKeys = new Set([
  "nav.crash",
  "nav.wallet",
  "nav.fairness",
  "nav.support",
]);

function SideNav({
  isAdmin,
  publicView = false,
  onNavigate,
}: {
  isAdmin: boolean;
  publicView?: boolean;
  onNavigate?: () => void;
}) {
  const { t } = useI18n();
  const items = [
    ...railItems.filter((item) => !(publicView && gatedLabels.includes(item.label))),
    ...(isAdmin && !publicView
      ? ([{ to: "/admin", label: "Back office", key: "nav.backOffice", icon: ShieldCheck }] as const)
      : []),
  ];
  return (
    <nav className="flex flex-col gap-0.5" aria-label={t("ui.sectionsNav")}>
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
          <span className="truncate">{t(item.key)}</span>
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
      <p dir="ltr" className="mt-1 font-display text-2xl font-black tabular-nums text-primary rtl:text-end">
        {publicView ? formatMoney(0) : formatMoney(balance)}
      </p>
      {publicView ? (
        <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
          {t("nav.signInToFund")}
        </p>
      ) : null}
      <div className="mt-3 grid gap-2">
        <Link
          to={publicView ? "/auth" : "/wallet"}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-thrust px-3 py-2 text-xs font-bold text-primary-foreground shadow-orbit transition-transform hover:scale-[1.02]"
        >
          <ArrowDownToLine className="size-4" aria-hidden />
          {t("nav.deposit")}
        </Link>
        <Link
          to={publicView ? "/auth" : "/wallet"}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-secondary/50 px-3 py-2 text-xs font-bold transition-colors hover:bg-secondary"
        >
          <ArrowUpFromLine className="size-4" aria-hidden />
          {t("nav.withdraw")}
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
  const username = user?.email ? (user.email.split("@")[0] ?? null) : null;

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
              aria-label={t("ui.openMenu")}
              className="grid size-9 shrink-0 place-items-center rounded-xl border border-border lg:hidden"
            >
              <Menu className="size-4" aria-hidden />
            </button>
            <BrandMark />
          </div>

          <nav className="hidden min-w-0 items-center gap-1 xl:flex" aria-label={t("ui.primaryNav")}>
            {topNav
              .filter((item) => !(publicView && gatedTopNavKeys.has(item.key)))
              .map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  className="nav-pill hover:text-foreground"
                  activeProps={{ className: "nav-pill nav-pill-active" }}
                  activeOptions={{ exact: item.to === "/" }}
                >
                  {t(item.key)}
                </Link>
              ))}
          </nav>

          <div className="flex items-center justify-end gap-2">
            <span className="hidden md:block">
              <LanguageSwitcher />
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
                  to="/wallet"
                  className="rounded-xl bg-thrust px-4 py-2 text-xs font-bold text-primary-foreground shadow-orbit transition-transform hover:scale-[1.03]"
                >
                  {t("nav.deposit")}
                </Link>
                <InboxMenu />
                <AccountMenu username={username} balance={balance} />
              </>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1600px] gap-4 px-3 py-4 sm:px-4">
        <aside className="sticky top-[72px] hidden h-[calc(100vh-88px)] w-60 shrink-0 flex-col justify-between overflow-y-auto panel p-3 lg:flex">
          <div className="space-y-3">
            <BalanceCard balance={balance} publicView={publicView} />
            <SideNav isAdmin={isAdmin} publicView={publicView} />
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
              <button type="button" aria-label={t("ui.closeMenu")} onClick={() => setOpen(false)}>
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <div className="mb-3">
              <BalanceCard balance={balance} publicView={publicView} />
            </div>
            <SideNav isAdmin={isAdmin} publicView={publicView} onNavigate={() => setOpen(false)} />
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
