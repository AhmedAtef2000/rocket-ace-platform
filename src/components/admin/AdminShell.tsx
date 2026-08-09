import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  BadgeCheck,
  BarChart3,
  Bell,
  CircleDollarSign,
  ClipboardList,
  Gauge,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  MailOpen,
  Menu,
  Rocket,
  Search,
  Settings,
  ShieldAlert,
  Users,
  Wallet,
  X,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { useI18n, type TranslationKey } from "@/lib/i18n";

export type AdminSection =
  | "dashboard"
  | "users"
  | "kyc"
  | "deposits"
  | "withdrawals"
  | "risk"
  | "support"
  | "analytics"
  | "audit"
  | "settings";

type Item = {
  id: AdminSection;
  key: TranslationKey;
  icon: typeof Users;
  permission: string;
};

type Group = { key: TranslationKey; items: Item[] };

export const adminGroups: Group[] = [
  {
    key: "admin.nav.group.management",
    items: [
      { id: "users", key: "admin.nav.users", icon: Users, permission: "user.view" },
      { id: "kyc", key: "admin.nav.kyc", icon: BadgeCheck, permission: "kyc.view" },
      { id: "deposits", key: "admin.nav.deposits", icon: CircleDollarSign, permission: "finance.view" },
      { id: "withdrawals", key: "admin.nav.withdrawals", icon: Wallet, permission: "withdrawal.review" },
    ],
  },
  {
    key: "admin.nav.group.risk",
    items: [
      { id: "risk", key: "admin.nav.risk", icon: ShieldAlert, permission: "risk.view" },
      { id: "audit", key: "admin.nav.audit", icon: ClipboardList, permission: "audit.view" },
    ],
  },
  {
    key: "admin.nav.group.support",
    items: [{ id: "support", key: "admin.nav.support", icon: LifeBuoy, permission: "support.view" }],
  },
  {
    key: "admin.nav.group.analytics",
    items: [{ id: "analytics", key: "admin.nav.analytics", icon: BarChart3, permission: "analytics.view" }],
  },
  {
    key: "admin.nav.group.settings",
    items: [{ id: "settings", key: "admin.nav.settings", icon: Settings, permission: "admin.manage" }],
  },
];

function NavLink({
  id,
  label,
  active,
  icon: Icon,
  onNavigate,
}: {
  id: AdminSection;
  label: string;
  active: boolean;
  icon: typeof Users;
  onNavigate?: () => void;
}) {
  return (
    <Link
      to="/admin"
      search={{ section: id }}
      onClick={onNavigate}
      className={
        active
          ? "flex items-center gap-3 rounded-lg bg-primary/15 px-3 py-2 text-sm font-semibold text-foreground shadow-[inset_2px_0_0_0_var(--color-primary)] [&_svg]:text-primary"
          : "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
      }
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function Rail({
  active,
  can,
  onNavigate,
}: {
  active: AdminSection;
  can: (permission: string) => boolean;
  onNavigate?: () => void;
}) {
  const { t } = useI18n();
  return (
    <nav className="space-y-4" aria-label={t("admin.nav.aria")}>
      <NavLink
        id="dashboard"
        label={t("admin.nav.dashboard")}
        active={active === "dashboard"}
        icon={LayoutDashboard}
        {...(onNavigate ? { onNavigate } : {})}
      />
      {adminGroups.map((group) => {
        const items = group.items.filter((item) => can(item.permission));
        if (items.length === 0) return null;
        return (
          <div key={group.key}>
            <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70">
              {t(group.key)}
            </p>
            <div className="space-y-0.5">
              {items.map((item) => (
                <NavLink
                  key={item.id}
                  id={item.id}
                  label={t(item.key)}
                  active={active === item.id}
                  icon={item.icon}
                  {...(onNavigate ? { onNavigate } : {})}
                />
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

/** Dedicated back-office chrome: only operators ever see this layout. */
export function AdminShell({
  children,
  active,
  can,
  roleLabel,
  email,
  alerts = 0,
  messages = 0,
}: {
  children: ReactNode;
  active: AdminSection;
  can: (permission: string) => boolean;
  roleLabel: string;
  email: string | null;
  alerts?: number;
  messages?: number;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-card/80 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={t("ui.openMenu")}
            className="grid size-9 shrink-0 place-items-center rounded-lg border border-border lg:hidden"
          >
            <Menu className="size-4" aria-hidden />
          </button>
          <Link to="/admin" search={{ section: "dashboard" }} className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-thrust">
              <Rocket className="size-4 text-primary-foreground" aria-hidden />
            </span>
            <span className="font-display text-base font-black tracking-tight">
              ASTRO<span className="text-primary">BET</span>
            </span>
          </Link>

          <div className="relative mx-auto hidden w-full max-w-xl md:block">
            <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" aria-hidden />
            <input
              readOnly
              onFocus={(e) => e.currentTarget.blur()}
              placeholder={t("admin.search.placeholder")}
              className="w-full cursor-pointer rounded-full border border-border bg-secondary/40 py-2 ps-9 pe-3 text-sm outline-none"
              onClick={() => {
                window.location.href = "/admin?section=users";
              }}
            />
          </div>

          <div className="ms-auto flex items-center gap-2">
            <span className="hidden md:block">
              <LanguageSwitcher />
            </span>
            <span className="relative grid size-9 place-items-center rounded-lg border border-border" title={t("admin.nav.risk")}>
              <Bell className="size-4" aria-hidden />
              {alerts > 0 ? (
                <span className="absolute -end-1 -top-1 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-primary-foreground">
                  {alerts}
                </span>
              ) : null}
            </span>
            <span className="relative grid size-9 place-items-center rounded-lg border border-border" title={t("admin.nav.support")}>
              <MailOpen className="size-4" aria-hidden />
              {messages > 0 ? (
                <span className="absolute -end-1 -top-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {messages}
                </span>
              ) : null}
            </span>
            <div className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5">
              <span className="grid size-7 place-items-center rounded-lg bg-secondary text-[11px] font-black uppercase">
                {(email ?? "AD").slice(0, 2)}
              </span>
              <span className="hidden leading-tight sm:block">
                <span className="block max-w-36 truncate text-[11px] font-bold">{email ?? t("admin.role.admin")}</span>
                <span className="block text-[10px] text-muted-foreground">{roleLabel}</span>
              </span>
            </div>
            <button
              type="button"
              onClick={() => void supabase.auth.signOut()}
              aria-label={t("nav.signOut")}
              className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
            >
              <LogOut className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="sticky top-[57px] hidden h-[calc(100vh-57px)] w-60 shrink-0 flex-col justify-between overflow-y-auto border-e border-border/70 bg-card/40 p-3 lg:flex">
          <Rail active={active} can={can} />
          <div className="mt-4 rounded-lg border border-success/30 bg-success/10 p-3">
            <p className="flex items-center gap-2 text-xs font-bold">
              <Activity className="size-4 text-success" aria-hidden />
              {t("admin.system.status")}
            </p>
            <p className="mt-1 text-[11px] text-success">{t("admin.system.operational")}</p>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-3 pb-12 pt-4 sm:px-5">{children}</main>
      </div>

      <footer className="border-t border-border/70 px-4 py-3 text-[11px] text-muted-foreground">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>{t("admin.footer.rights")}</span>
          <span className="flex items-center gap-1">
            <Gauge className="size-3.5" aria-hidden />
            {t("admin.footer.console")}
          </span>
        </div>
      </footer>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label={t("ui.closeMenu")}
            className="absolute inset-0 bg-background/80 backdrop-blur"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 start-0 w-72 overflow-y-auto border-e border-border bg-card p-3">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-display text-base font-black">
                ASTRO<span className="text-primary">BET</span>
              </span>
              <button type="button" aria-label={t("ui.closeMenu")} onClick={() => setOpen(false)}>
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <Rail active={active} can={can} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
