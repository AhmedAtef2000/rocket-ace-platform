import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { provisionAccount } from "@/lib/account.functions";

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
  component: () => <Outlet />,
});