import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BadgeCheck,
  LayoutGrid,
  LogOut,
  Menu,
  Rocket,
  ShieldCheck,
  ShieldQuestion,
  Sparkle,
  UserRound,
  Wallet,
  X,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { InboxMenu } from "@/components/layout/InboxMenu";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { useI18n } from "@/lib/i18n";
import { getAdminSession } from "@/lib/admin.functions";
import { getWallets } from "@/lib/wallet.functions";

const navItems = [
  { to: "/game", label: "Crash", icon: Rocket },
  { to: "/account", label: "Lobby", icon: LayoutGrid },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/payments", label: "Cashier", icon: Sparkle },
  { to: "/fairness", label: "Fairness", icon: BadgeCheck },
  { to: "/compliance", label: "Verification", icon: ShieldCheck },
  { to: "/profile", label: "Profile", icon: UserRound },
  { to: "/security", label: "Security", icon: ShieldQuestion },
] as const;

function SideNav({ isAdmin, onNavigate }: { isAdmin: boolean; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1" aria-label="Sections">
      {[...navItems, ...(isAdmin ? ([{ to: "/admin", label: "Back office", icon: ShieldCheck }] as const) : [])].map(
        (item) => (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
            activeProps={{
              className:
                "flex items-center gap-3 rounded-xl bg-thrust px-3 py-2.5 text-sm font-semibold text-primary-foreground shadow-orbit",
            }}
          >
            <item.icon className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{item.label}</span>
          </Link>
        ),
      )}
    </nav>
  );
}

/** Casino-style chrome: left game rail, sticky balance bar, aurora backdrop. */
export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const fetchAdminSession = useServerFn(getAdminSession);
  const fetchWallets = useServerFn(getWallets);

  const admin = useQuery({
    queryKey: ["admin", "session"],
    queryFn: async () => fetchAdminSession({ data: undefined }),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const wallets = useQuery({
    queryKey: ["wallet", "summary"],
    queryFn: async () => fetchWallets({ data: undefined }),
    retry: false,
  });
  const isAdmin = Boolean(admin.data?.identity);
  const main = wallets.data?.wallets?.[0];
  const balance = Number(main?.available_amount ?? 0);

  return (
    <div
      className="relative min-h-screen bg-background bg-fixed bg-no-repeat text-foreground"
      style={{ backgroundImage: "var(--surface-glow)" }}
    >
      <div className="mx-auto flex w-full max-w-[1500px] gap-4 p-3 sm:p-4">
        <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-60 shrink-0 flex-col justify-between panel p-3 lg:flex">
          <div>
            <Link to="/" className="flex items-center gap-2 px-1 py-2">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-thrust">
                <Rocket className="size-5 text-primary-foreground" aria-hidden />
              </span>
              <span className="font-display text-lg font-extrabold tracking-tight">AstroBet</span>
            </Link>
            <p className="mb-3 px-1 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              Rocket crash
            </p>
            <SideNav isAdmin={isAdmin} />
          </div>
          <div className="space-y-2">
            <LanguageSwitcher />
            <button
              type="button"
              onClick={() => void supabase.auth.signOut()}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
            >
              <LogOut className="size-4" aria-hidden />
              {t("nav.signOut")}
            </button>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-3 z-30 mb-4 panel">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  aria-label="Open menu"
                  className="grid size-9 shrink-0 place-items-center rounded-xl border border-border lg:hidden"
                >
                  <Menu className="size-4" aria-hidden />
                </button>
                <Link to="/game" className="hidden min-w-0 items-center gap-2 sm:flex">
                  <span className="chip">Rocket crash · live</span>
                </Link>
              </div>
              <div className="flex items-center gap-2">
                <div className="panel-inset px-3 py-1.5 text-right">
                  <p className="text-[9px] uppercase tracking-widest text-muted-foreground">
                    Balance
                  </p>
                  <p className="font-mono text-sm font-semibold tabular-nums">
                    {balance.toFixed(2)}
                  </p>
                </div>
                <Link
                  to="/payments"
                  className="rounded-xl bg-thrust px-3 py-2 text-xs font-bold text-primary-foreground shadow-orbit transition-transform hover:scale-[1.03]"
                >
                  Deposit
                </Link>
                <InboxMenu />
              </div>
            </div>
          </header>
          {children}
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-background/80 backdrop-blur"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 start-0 w-64 panel p-3">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-display text-lg font-extrabold">AstroBet</span>
              <button type="button" aria-label="Close menu" onClick={() => setOpen(false)}>
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <SideNav isAdmin={isAdmin} onNavigate={() => setOpen(false)} />
            <div className="mt-3 space-y-2">
              <LanguageSwitcher />
              <button
                type="button"
                onClick={() => void supabase.auth.signOut()}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground"
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
