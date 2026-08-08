import { Link } from "@tanstack/react-router";

const items = [
  { to: "/account", label: "Overview" },
  { to: "/game", label: "Crash game" },
  { to: "/wallet", label: "Wallet" },
  { to: "/payments", label: "Deposits & withdrawals" },
  { to: "/profile", label: "Profile" },
  { to: "/compliance", label: "Verification" },
  { to: "/security", label: "Security" },
  { to: "/responsible-gambling", label: "Responsible gambling" },
] as const;

export function AccountNav() {
  return (
    <nav className="mt-6 flex flex-wrap gap-2" aria-label="Account sections">
      {items.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className="rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          activeProps={{
            className:
              "rounded-full border border-primary/50 bg-primary/10 px-3 py-1.5 text-sm text-foreground",
          }}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
