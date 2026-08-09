import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getAdminSession } from "@/lib/admin.functions";

const items = [
  { to: "/account", label: "Overview" },
  { to: "/game", label: "Crash game" },
  { to: "/fairness", label: "Fairness" },
  { to: "/wallet", label: "Wallet" },
  { to: "/payments", label: "Deposits & withdrawals" },
  { to: "/profile", label: "Profile" },
  { to: "/compliance", label: "Verification" },
  { to: "/security", label: "Security" },
  { to: "/notifications", label: "Notifications" },
  { to: "/support", label: "Support" },
] as const;

export function AccountNav() {
  const fetchAdminSession = useServerFn(getAdminSession);
  const admin = useQuery({
    queryKey: ["admin", "session"],
    queryFn: async () => fetchAdminSession({ data: undefined }),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const isAdmin = Boolean(admin.data?.identity);

  return (
    <nav className="mt-6 flex flex-wrap gap-2" aria-label="Account sections">
      {[...items, ...(isAdmin ? ([{ to: "/admin", label: "Back office" }] as const) : [])].map((item) => (
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
