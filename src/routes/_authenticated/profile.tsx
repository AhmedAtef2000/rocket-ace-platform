import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { getUserManagement, updateProfile } from "@/lib/user.functions";
import { AccountNav } from "@/components/account/AccountNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";

const title = "Profile — AstroBet";
const description =
  "Manage the personal details on your AstroBet account: name, contact details, address and identity data used for KYC.";

export const Route = createFileRoute("/_authenticated/profile")({
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
  component: ProfilePage,
});

type FormState = {
  first_name: string;
  last_name: string;
  phone: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  postal_code: string;
  country_code: string;
  date_of_birth: string;
};

const empty: FormState = {
  first_name: "",
  last_name: "",
  phone: "",
  address_line_1: "",
  address_line_2: "",
  city: "",
  postal_code: "",
  country_code: "",
  date_of_birth: "",
};

function ProfilePage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const fetchAll = useServerFn(getUserManagement);
  const save = useServerFn(updateProfile);
  const [form, setForm] = useState<FormState>(empty);

  const account = useQuery({
    queryKey: ["user-management"],
    queryFn: async () => fetchAll({ data: undefined }),
  });

  useEffect(() => {
    if (!account.data) return;
    const p = account.data.profile;
    const u = account.data.user;
    setForm({
      first_name: p?.first_name ?? "",
      last_name: p?.last_name ?? "",
      phone: p?.phone ?? "",
      address_line_1: p?.address_line_1 ?? "",
      address_line_2: p?.address_line_2 ?? "",
      city: p?.city ?? "",
      postal_code: p?.postal_code ?? "",
      country_code: u?.country_code ?? "",
      date_of_birth: u?.date_of_birth ?? "",
    });
  }, [account.data]);

  const mutation = useMutation({
    mutationFn: async (values: FormState) => save({ data: values }),
    onSuccess: async () => {
      toast.success(t("acct.profile.saved"));
      await queryClient.invalidateQueries({ queryKey: ["user-management"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const countryLocked = !!account.data?.user?.country_code;
  const dobLocked = !!account.data?.user?.date_of_birth;
  const firstNameLocked = !!account.data?.profile?.first_name;
  const lastNameLocked = !!account.data?.profile?.last_name;
  const phoneLocked = !!account.data?.profile?.phone;
  const anyLocked = firstNameLocked || lastNameLocked || phoneLocked || dobLocked;

  function field(key: keyof FormState) {
    return {
      value: form[key],
      onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
        setForm((prev) => ({ ...prev, [key]: event.target.value })),
    };
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-8">
      <div className="w-full">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">{t("acct.profile.title")}</h1>
        <AccountNav />

        {account.isPending ? (
          <p className="mt-6 text-sm text-muted-foreground">{t("acct.profile.loading")}</p>
        ) : (
          <form
            className="mt-6 space-y-6"
            onSubmit={(event) => {
              event.preventDefault();
              mutation.mutate(form);
            }}
          >
            <section className="space-y-4 rounded-2xl border border-border bg-card/60 p-5">
              <h2 className="text-sm font-medium text-foreground">{t("acct.profile.personalDetails")}</h2>
              {anyLocked ? (
                <p className="rounded-xl border border-border bg-background/50 p-3 text-xs text-muted-foreground">
                  {t("acct.profile.lockedNotice")}{" "}
                  <Link to="/support" className="font-medium text-foreground underline">
                    {t("acct.profile.openTicket")}
                  </Link>{" "}
                  {t("acct.profile.lockedNoticeSuffix")}
                </p>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="first_name">{t("acct.profile.firstName")}</Label>
                  <Input
                    id="first_name"
                    autoComplete="given-name"
                    disabled={firstNameLocked}
                    {...field("first_name")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">{t("acct.profile.lastName")}</Label>
                  <Input
                    id="last_name"
                    autoComplete="family-name"
                    disabled={lastNameLocked}
                    {...field("last_name")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">{t("acct.profile.phone")}</Label>
                  <Input id="phone" autoComplete="tel" disabled={phoneLocked} {...field("phone")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date_of_birth">{t("acct.profile.dateOfBirth")}</Label>
                  <Input
                    id="date_of_birth"
                    type="date"
                    disabled={dobLocked}
                    {...field("date_of_birth")}
                  />
                  <p className="text-xs text-muted-foreground">
                    {dobLocked
                      ? t("acct.profile.dobLocked")
                      : t("acct.profile.dobHint")}
                  </p>
                </div>
              </div>
            </section>

            <section className="space-y-4 rounded-2xl border border-border bg-card/60 p-5">
              <h2 className="text-sm font-medium text-foreground">{t("acct.profile.address")}</h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="address_line_1">{t("acct.profile.addressLine1")}</Label>
                  <Input id="address_line_1" autoComplete="address-line1" {...field("address_line_1")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address_line_2">{t("acct.profile.addressLine2")}</Label>
                  <Input id="address_line_2" autoComplete="address-line2" {...field("address_line_2")} />
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="city">{t("acct.profile.city")}</Label>
                    <Input id="city" autoComplete="address-level2" {...field("city")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="postal_code">{t("acct.profile.postalCode")}</Label>
                    <Input id="postal_code" autoComplete="postal-code" {...field("postal_code")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country_code">{t("acct.profile.countryCode")}</Label>
                    <Input
                      id="country_code"
                      maxLength={2}
                      placeholder="EG"
                      disabled={countryLocked}
                      {...field("country_code")}
                    />
                  </div>
                </div>
              </div>
            </section>

            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? t("acct.profile.saving") : t("acct.profile.saveProfile")}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
