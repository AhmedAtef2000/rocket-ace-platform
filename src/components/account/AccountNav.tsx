import { Link } from "@tanstack/react-router";

const items = [
  { to: "/account", label: "Overview" },
  { to: "/game", label: "Crash game" },
  { to: "/fairness", label: "Fairness" },
  { to: "/wallet", label: "Wallet" },
  { to: "/payments", label: "Deposits & withdrawals" },
  { to: "/profile", label: "Profile" },
  { to: "/compliance", label: "Verification" },
  { to: "/security", label: "Security" },
  { to: "/responsible-gambling", label: "Responsible gambling" },
  { to: "/notifications", label: "Notifications" },
  { to: "/support", label: "Support" },
  { to: "/admin", label: "Back office" },
] as const;

export function AccountNav() {
  return (
    <nav className="mt-6 flex flex-wrap gap-2" aria-label="Account sections">
      {items.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className="rounded-full border border-border bg-card/50 px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          activeProps={{
            className:
              "rounded-full border border-primary/60 bg-primary/15 px-3.5 py-1.5 text-xs font-semibold text-foreground",
          }}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
