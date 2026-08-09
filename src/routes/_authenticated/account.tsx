import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { getAccount, provisionAccount } from "@/lib/account.functions";
import { Button } from "@/components/ui/button";
import { AccountNav } from "@/components/account/AccountNav";
import { SessionRegistrar } from "@/components/account/SessionRegistrar";
import { useI18n } from "@/lib/i18n";

const title = "Your account — AstroBet";
const description =
  "Your AstroBet account overview: wallets, account status and responsible gambling state.";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const provision = useServerFn(provisionAccount);
  const fetchAccount = useServerFn(getAccount);

  const provisioned = useQuery({
    queryKey: ["account", "provision"],
    queryFn: async () => provision({ data: undefined }),
    staleTime: Infinity,
    retry: 1,
  });

  const account = useQuery({
    queryKey: ["account", "overview"],
    queryFn: async () => fetchAccount({ data: undefined }),
    enabled: provisioned.isSuccess,
  });

  useEffect(() => {
    if (provisioned.isError) toast.error(t("acct.couldNotPrepare"));
  }, [provisioned.isError]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    queryClient.clear();
    void navigate({ to: "/auth" });
  }

  const user = account.data?.user;
  const wallets = account.data?.wallets ?? [];

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-8">
      <SessionRegistrar />
      <div className="w-full">
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-display text-3xl font-extrabold tracking-tight">{t("acct.yourAccount")}</h1>
          <Button variant="outline" onClick={handleSignOut}>
            {t("acct.signOut")}
          </Button>
        </div>

        <AccountNav />

        {account.isPending ? (
          <p className="mt-6 text-sm text-muted-foreground">{t("acct.loading")}</p>
        ) : (
          <div className="mt-6 space-y-6">
            <section className="rounded-2xl border border-border bg-card/60 p-5">
              <h2 className="text-sm font-medium text-foreground">{t("acct.identity")}</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <Row label={t("acct.email")} value={user?.email ?? "—"} />
                <Row label={t("acct.status")} value={user?.status ?? "—"} />
                <Row label={t("acct.mfa")} value={user?.mfa_enabled ? t("acct.mfaEnabled") : t("acct.mfaNotEnabled")} />
              </dl>
            </section>

            <section className="rounded-2xl border border-border bg-card/60 p-5">
              <h2 className="text-sm font-medium text-foreground">{t("acct.wallets")}</h2>
              {wallets.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">{t("acct.noWallets")}</p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm">
                  {wallets.map((wallet) => (
                    <li key={wallet.id} className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        {wallet.currency} · {wallet.kind}
                      </span>
                      <span className="font-mono text-foreground">{wallet.available_amount}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-muted-foreground">{t("acct.balancesNote")}</p>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}