import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  getUserManagement,
  startCoolingOff,
  startSelfExclusion,
  updateResponsibleGamblingLimits,
} from "@/lib/user.functions";
import { AccountNav } from "@/components/account/AccountNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const title = "Responsible gambling — Rocket Flight";
const description =
  "Set deposit and loss limits, start a cooling-off period or self-exclude from Rocket Flight at any time.";

export const Route = createFileRoute("/_authenticated/responsible-gambling")({
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
  component: ResponsibleGamblingPage,
});

const limitFields = [
  { key: "deposit_daily_limit", label: "Deposit limit — daily" },
  { key: "deposit_weekly_limit", label: "Deposit limit — weekly" },
  { key: "deposit_monthly_limit", label: "Deposit limit — monthly" },
  { key: "loss_daily_limit", label: "Loss limit — daily" },
  { key: "loss_weekly_limit", label: "Loss limit — weekly" },
  { key: "loss_monthly_limit", label: "Loss limit — monthly" },
  { key: "session_limit_minutes", label: "Session limit (minutes)" },
] as const;

type LimitKey = (typeof limitFields)[number]["key"];

function ResponsibleGamblingPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const fetchAll = useServerFn(getUserManagement);
  const saveLimits = useServerFn(updateResponsibleGamblingLimits);
  const coolOff = useServerFn(startCoolingOff);
  const exclude = useServerFn(startSelfExclusion);

  const [form, setForm] = useState<Record<LimitKey, string>>(() =>
    Object.fromEntries(limitFields.map((f) => [f.key, ""])) as Record<LimitKey, string>,
  );

  const account = useQuery({
    queryKey: ["user-management"],
    queryFn: async () => fetchAll({ data: undefined }),
  });

  useEffect(() => {
    const limits = account.data?.limits;
    if (!limits) return;
    setForm(
      Object.fromEntries(
        limitFields.map((f) => {
          const value = (limits as Record<string, unknown>)[f.key];
          return [f.key, value === null || value === undefined ? "" : String(value)];
        }),
      ) as Record<LimitKey, string>,
    );
  }, [account.data]);

  const save = useMutation({
    mutationFn: async () => {
      const payload: Record<string, number | null> = {};
      for (const f of limitFields) {
        const raw = form[f.key].trim();
        payload[f.key] = raw === "" ? null : Number(raw);
      }
      return saveLimits({ data: payload });
    },
    onSuccess: async (result) => {
      if (result.rejected.length > 0) {
        toast.warning(
          "Increasing or removing a limit needs a support review — those changes were not applied.",
        );
      }
      if (Object.keys(result.applied).length > 0) toast.success("Limits tightened immediately.");
      await queryClient.invalidateQueries({ queryKey: ["user-management"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const cooling = useMutation({
    mutationFn: async (days: number) => coolOff({ data: { days } }),
    onSuccess: async (result) => {
      toast.success(`Cooling-off active until ${new Date(result.until).toLocaleString()}.`);
      await queryClient.invalidateQueries({ queryKey: ["user-management"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const selfExclude = useMutation({
    mutationFn: async (months: number) => exclude({ data: { months } }),
    onSuccess: async () => {
      await supabase.auth.signOut();
      queryClient.clear();
      toast.success("Self-exclusion is active. Your account is now closed for play.");
      void navigate({ to: "/" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const limits = account.data?.limits;
  const locked = account.data?.locked;

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <h1 className="text-2xl font-semibold text-foreground">Responsible gambling</h1>
        <AccountNav />

        {locked?.coolingOff ? (
          <p className="mt-6 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm text-warning">
            Cooling-off active until {new Date(limits!.cooling_off_until!).toLocaleString()}. Play is
            blocked until then.
          </p>
        ) : null}

        <section className="mt-6 space-y-4 rounded-lg border border-border p-4">
          <div>
            <h2 className="text-sm font-medium text-foreground">Your limits</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Lowering a limit applies instantly. Raising or removing one requires a support review,
              so a limit can never be weakened in the heat of the moment.
            </p>
          </div>

          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate();
            }}
          >
            {limitFields.map((f) => (
              <div key={f.key} className="space-y-2">
                <Label htmlFor={f.key}>{f.label}</Label>
                <Input
                  id={f.key}
                  inputMode="decimal"
                  placeholder="No limit"
                  value={form[f.key]}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, [f.key]: event.target.value }))
                  }
                />
              </div>
            ))}
            <div className="sm:col-span-2">
              <Button type="submit" disabled={save.isPending || account.isPending}>
                {save.isPending ? "Saving…" : "Save limits"}
              </Button>
            </div>
          </form>
        </section>

        <section className="mt-6 space-y-4 rounded-lg border border-border p-4">
          <h2 className="text-sm font-medium text-foreground">Take a break</h2>
          <p className="text-sm text-muted-foreground">
            A cooling-off period blocks play immediately and cannot be shortened once started.
          </p>
          <div className="flex flex-wrap gap-2">
            {[1, 7, 30].map((days) => (
              <Button
                key={days}
                variant="outline"
                onClick={() => cooling.mutate(days)}
                disabled={cooling.isPending}
              >
                {days} day{days > 1 ? "s" : ""}
              </Button>
            ))}
          </div>
        </section>

        <section className="mt-6 space-y-4 rounded-lg border border-destructive/40 p-4">
          <h2 className="text-sm font-medium text-destructive">Self-exclusion</h2>
          <p className="text-sm text-muted-foreground">
            Self-exclusion closes your account for play, signs out every device and cannot be
            reversed before it expires.
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              { months: 6, label: "6 months" },
              { months: 12, label: "1 year" },
              { months: 60, label: "5 years" },
            ].map((option) => (
              <AlertDialog key={option.months}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={selfExclude.isPending}>
                    {option.label}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Self-exclude for {option.label}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This is permanent for the whole period. You will be signed out and cannot
                      play, deposit or reopen the account until it expires.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => selfExclude.mutate(option.months)}>
                      Confirm self-exclusion
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
