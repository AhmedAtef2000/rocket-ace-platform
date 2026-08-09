import { useEffect } from "react";
import {
  createFileRoute,
  Outlet,
  redirect,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { provisionAccount } from "@/lib/account.functions";
import { AppShell } from "@/components/layout/AppShell";
import { getAdminSession } from "@/lib/admin.functions";

/**
 * Operators never see the player product: as soon as an admin identity is
 * detected they are sent straight into the back office, which brings its own
 * chrome. Everyone else keeps the normal player shell.
 */
function AuthenticatedLayout() {
  const fetchAdminSession = useServerFn(getAdminSession);
  const navigate = useNavigate();
  const location = useLocation();
  const admin = useQuery({
    queryKey: ["admin", "session"],
    queryFn: async () => fetchAdminSession({ data: undefined }),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const isAdmin = Boolean(admin.data?.identity);
  const onAdminRoute = location.pathname.startsWith("/admin");

  useEffect(() => {
    if (isAdmin && !onAdminRoute) {
      void navigate({ to: "/admin", search: { section: "dashboard" }, replace: true });
    }
  }, [isAdmin, onAdminRoute, navigate]);

  if (admin.isLoading) {
    return <div className="min-h-screen bg-background" aria-busy="true" />;
  }
  if (isAdmin) return <Outlet />;
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    // Domain records are created lazily on first authenticated navigation so
    // every protected page can assume a user row, profile, RG limits and wallet.
    await provisionAccount({ data: undefined });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});