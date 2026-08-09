import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { useAuth } from "@/hooks/useAuth";
import { AdminShell } from "@/components/admin/AdminShell";
import { User360Workspace } from "@/components/admin/User360Workspace";
import { getAdminSession } from "@/lib/admin.functions";

const title = "User 360 — AstroBet back office";
const description =
  "Full operator view of a single player: balances, betting, transactions, KYC, security, risk and support history.";

export const Route = createFileRoute("/_authenticated/admin_/users/$userId")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: User360Page,
});

function User360Page() {
  const { userId } = Route.useParams();
  const { user } = useAuth();
  const sessionFn = useServerFn(getAdminSession);
  const session = useQuery({
    queryKey: ["admin", "session"],
    queryFn: async () => sessionFn({ data: undefined }),
  });

  const identity = session.data?.identity ?? null;
  const can = (permission: string) => identity?.permissions.includes(permission) ?? false;

  return (
    <AdminShell
      active="users"
      can={can}
      roleLabel={(identity?.roleKey ?? "STAFF").replace(/_/g, " ")}
      email={user?.email ?? null}
    >
      <User360Workspace userId={userId} />
    </AdminShell>
  );
}