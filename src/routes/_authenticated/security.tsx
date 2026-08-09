import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  getUserManagement,
  revokeOtherSessions,
  revokeSession,
  syncMfaStatus,
} from "@/lib/user.functions";
import { AccountNav } from "@/components/account/AccountNav";
import { SessionRegistrar } from "@/components/account/SessionRegistrar";
import { useDeviceId } from "@/hooks/useDeviceId";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";

const title = "Security — AstroBet";
const description =
  "Protect your AstroBet account with two-factor authentication and review or sign out active devices.";

export const Route = createFileRoute("/_authenticated/security")({
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
  component: SecurityPage,
});

type Factor = { id: string; status: string; friendly_name?: string | undefined };

function SecurityPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const deviceId = useDeviceId();
  const fetchAll = useServerFn(getUserManagement);
  const sync = useServerFn(syncMfaStatus);
  const revokeOne = useServerFn(revokeSession);
  const revokeRest = useServerFn(revokeOtherSessions);

  const account = useQuery({
    queryKey: ["user-management"],
    queryFn: async () => fetchAll({ data: undefined }),
  });

  const factors = useQuery({
    queryKey: ["mfa", "factors"],
    queryFn: async (): Promise<Factor[]> => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw new Error(error.message);
      return (data?.all ?? []) as Factor[];
    },
  });

  const verified = (factors.data ?? []).filter((f) => f.status === "verified");

  const [enrolling, setEnrolling] = useState<{ factorId: string; qr: string } | null>(null);
  const [code, setCode] = useState("");

  useEffect(() => {
    setCode("");
  }, [enrolling?.factorId]);

  const startEnroll = useMutation({
    mutationFn: async () => {
      // Clear abandoned, unverified factors so re-enrolling never collides.
      for (const factor of factors.data ?? []) {
        if (factor.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}`,
      });
      if (error) throw new Error(error.message);
      return { factorId: data.id, qr: data.totp.qr_code };
    },
    onSuccess: (data) => setEnrolling(data),
    onError: (error: Error) => toast.error(error.message),
  });

  const confirmEnroll = useMutation({
    mutationFn: async () => {
      if (!enrolling) throw new Error("Start enrollment first.");
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: enrolling.factorId,
        code: code.trim(),
      });
      if (error) throw new Error(error.message);
      return sync({ data: { enabled: true } });
    },
    onSuccess: async () => {
      setEnrolling(null);
      toast.success(t("acct.security.twoFactorEnabled"));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mfa", "factors"] }),
        queryClient.invalidateQueries({ queryKey: ["user-management"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const disableMfa = useMutation({
    mutationFn: async () => {
      for (const factor of factors.data ?? []) {
        const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
        if (error) throw new Error(error.message);
      }
      return sync({ data: { enabled: false } });
    },
    onSuccess: async () => {
      toast.success(t("acct.security.twoFactorRemoved"));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mfa", "factors"] }),
        queryClient.invalidateQueries({ queryKey: ["user-management"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const signOutDevice = useMutation({
    mutationFn: async (sessionId: string) => revokeOne({ data: { sessionId } }),
    onSuccess: async () => {
      toast.success(t("acct.security.deviceSignedOut"));
      await queryClient.invalidateQueries({ queryKey: ["user-management"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const signOutOthers = useMutation({
    mutationFn: async () => {
      if (!deviceId) throw new Error("Device not ready yet.");
      return revokeRest({ data: { keepId: deviceId } });
    },
    onSuccess: async () => {
      toast.success(t("acct.security.allOthersSignedOut"));
      await queryClient.invalidateQueries({ queryKey: ["user-management"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const sessions = (account.data?.sessions ?? []).filter((s) => !s.revoked_at);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-8">
      <SessionRegistrar />
      <div className="w-full">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">{t("acct.security.title")}</h1>
        <AccountNav />

        <section className="mt-6 space-y-4 rounded-2xl border border-border bg-card/60 p-5">
          <div>
            <h2 className="text-sm font-medium text-foreground">{t("acct.security.twoFactor")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {verified.length > 0
                ? t("acct.security.twoFactorOn")
                : t("acct.security.twoFactorOff")}
            </p>
          </div>

          {verified.length > 0 ? (
            <Button
              variant="outline"
              onClick={() => disableMfa.mutate()}
              disabled={disableMfa.isPending}
            >
              {disableMfa.isPending ? t("acct.security.removing") : t("acct.security.removeTwoFactor")}
            </Button>
          ) : enrolling ? (
            <div className="space-y-4">
              <img
                src={enrolling.qr}
                alt={t("acct.security.qrAlt")}
                className="size-44 rounded-md bg-card p-2"
              />
              <div className="space-y-2">
                <Label htmlFor="totp">{t("acct.security.sixDigitCode")}</Label>
                <Input
                  id="totp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={() => confirmEnroll.mutate()} disabled={confirmEnroll.isPending}>
                  {confirmEnroll.isPending ? t("acct.security.verifying") : t("acct.security.verifyAndEnable")}
                </Button>
                <Button variant="ghost" onClick={() => setEnrolling(null)}>
                  {t("acct.security.cancel")}
                </Button>
              </div>
            </div>
          ) : (
            <Button onClick={() => startEnroll.mutate()} disabled={startEnroll.isPending}>
              {startEnroll.isPending ? t("acct.security.preparing") : t("acct.security.setUpAuthenticator")}
            </Button>
          )}
        </section>

        <section className="mt-6 space-y-4 rounded-2xl border border-border bg-card/60 p-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-medium text-foreground">{t("acct.security.activeDevices")}</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => signOutOthers.mutate()}
              disabled={signOutOthers.isPending || sessions.length < 2}
            >
              {t("acct.security.signOutOthers")}
            </Button>
          </div>

          {account.isPending ? (
            <p className="text-sm text-muted-foreground">{t("acct.security.loadingDevices")}</p>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("acct.security.noDevices")}</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {sessions.map((session) => (
                <li key={session.id} className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-foreground">
                      {session.device_label ?? t("acct.security.unknownDevice")}
                      {session.id === deviceId ? (
                        <span className="ml-2 text-xs text-primary">{t("acct.security.thisDevice")}</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("acct.security.lastSeen", { time: new Date(session.last_seen_at).toLocaleString() })}
                    </p>
                  </div>
                  {session.id === deviceId ? null : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => signOutDevice.mutate(session.id)}
                      disabled={signOutDevice.isPending}
                    >
                      {t("acct.security.signOut")}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
