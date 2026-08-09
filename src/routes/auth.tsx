import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { checkRegistration, resolveLoginIdentifier } from "@/lib/registration.functions";
import { passwordProblems } from "@/lib/password";
import {
  COUNTRIES,
  DEFAULT_COUNTRY,
  composePhone,
  countryByIso,
  isValidLocalPhone,
  phoneLengthHint,
  stripDial,
} from "@/lib/countries";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuthShell } from "@/components/layout/AppShell";

const title = "Sign in — AstroBet";
const description =
  "Access your AstroBet account: provably fair crash rounds, wallet, responsible gambling controls and account security.";

type AuthSearch = { redirect?: string | undefined; mode?: "signin" | "signup" | undefined };

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): AuthSearch => ({
    redirect: typeof search["redirect"] === "string" ? search["redirect"] : undefined,
    mode: search["mode"] === "signup" ? "signup" : search["mode"] === "signin" ? "signin" : undefined,
  }),
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
  component: AuthPage,
});

function safePath(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/account";
  return value;
}

function AuthPage() {
  const search = useSearch({ from: "/auth" });
  const navigate = useNavigate();
  const destination = safePath(search.redirect);
  const { t, country } = useI18n();

  const [identifier, setIdentifier] = useState("");
  const [signInCountry, setSignInCountry] = useState(DEFAULT_COUNTRY);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingVerification, setPendingVerification] = useState<string | null>(null);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    email: "",
    phone: "",
    currency: "USD",
    password: "",
    confirm: "",
  });
  const [signUpCountry, setSignUpCountry] = useState(DEFAULT_COUNTRY);
  const setField = (key: keyof typeof form) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const problems = passwordProblems(form.password);
  const signUpDial = countryByIso(signUpCountry)?.dial ?? "+1";
  const signInDial = countryByIso(signInCountry)?.dial ?? "+1";
  const phoneValid = isValidLocalPhone(signUpCountry, form.phone);
  const phoneError = t("auth.phoneInvalid", {
    c: countryByIso(signUpCountry)?.name ?? signUpCountry,
    n: phoneLengthHint(signUpCountry),
  });
  // Every registration field is mandatory — the account cannot be created otherwise.
  const missingFields = (
    ["firstName", "lastName", "dateOfBirth", "email", "phone", "currency", "password", "confirm"] as const
  ).filter((key) => form[key].trim() === "");
  const signUpReady = missingFields.length === 0 && phoneValid;
  // Only a purely numeric identifier is treated as a phone number.
  const identifierIsPhone = /^[+\d][\d\s()-]*$/.test(identifier.trim()) && identifier.trim() !== "";

  // Apply the detected country (dial code + account currency) once geo resolves.
  useEffect(() => {
    const detected = countryByIso(country);
    if (!detected) return;
    setSignUpCountry(detected.iso);
    setSignInCountry(detected.iso);
    setForm((current) => ({ ...current, currency: detected.currency }));
  }, [country]);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) void navigate({ to: destination });
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: destination });
    });
    return () => sub.subscription.unsubscribe();
  }, [destination, navigate]);

  async function handleSignIn(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const value = identifierIsPhone ? composePhone(signInDial, identifier) : identifier;
      const { email } = await resolveLoginIdentifier({ data: { identifier: value } });
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      toast.success(t("auth.signedIn"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("auth.signInFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleSignUp(event: React.FormEvent) {
    event.preventDefault();
    if (missingFields.length > 0) {
      toast.error(t("auth.fillAll"));
      return;
    }
    if (!phoneValid) {
      toast.error(phoneError);
      return;
    }
    if (problems.length > 0) {
      toast.error(t("auth.passwordNeeds", { p: problems.join(", ") }));
      return;
    }
    if (form.password !== form.confirm) {
      toast.error(t("auth.passwordsMismatch"));
      return;
    }
    setBusy(true);
    try {
      const check = await checkRegistration({
        data: {
          firstName: form.firstName,
          lastName: form.lastName,
          dateOfBirth: form.dateOfBirth,
          email: form.email,
          phone: composePhone(signUpDial, form.phone),
          currency: form.currency,
        },
      });
      if (!check.ok) throw new Error(check.message);

      const { data, error } = await supabase.auth.signUp({
        email: check.email,
        password: form.password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            first_name: form.firstName,
            last_name: form.lastName,
            date_of_birth: form.dateOfBirth,
            phone: check.phone,
            primary_currency: check.currency,
          },
        },
      });
      if (error) throw new Error(error.message);
      if (!data.session) {
        setPendingVerification(check.email);
        toast.success(t("auth.verificationSent"));
      } else {
        toast.success(t("auth.accountCreated"));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("auth.signUpFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleOAuth(provider: "google" | "apple") {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    setBusy(false);
    if ("error" in result && result.error) toast.error(result.error.message);
  }

  async function handleReset() {
    if (!identifier.includes("@")) {
      toast.error(t("auth.resetNeedsEmail"));
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(identifier.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success(t("auth.resetSent"));
  }

  if (pendingVerification) {
    return (
      <AuthShell>
        <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight">
          {t("auth.verifyTitle")}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {t("auth.verifyBody", { email: pendingVerification })}
        </p>
        <Button className="mt-6 w-full" variant="outline" onClick={() => setPendingVerification(null)}>
          {t("auth.backToSignIn")}
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
        <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight">{t("auth.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("auth.subtitle")}</p>

        <Tabs defaultValue={search.mode === "signup" ? "signup" : "signin"} className="mt-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">{t("auth.signIn")}</TabsTrigger>
            <TabsTrigger value="signup">{t("auth.createAccount")}</TabsTrigger>
          </TabsList>

          <TabsContent value="signin">
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signin-identifier">{t("auth.identifier")}</Label>
                <div className="flex gap-2">
                  {identifierIsPhone ? (
                    <select
                      aria-label={t("auth.countryCode")}
                      dir="ltr"
                      value={signInCountry}
                      onChange={(event) => {
                        setIdentifier(stripDial(identifier, signInDial));
                        setSignInCountry(event.target.value);
                      }}
                      className="h-10 w-32 shrink-0 rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c.iso} value={c.iso}>
                          {c.iso} {c.dial}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <Input
                    id="signin-identifier"
                    type="text"
                    autoComplete="username"
                    required
                    value={identifier}
                    onChange={(event) => {
                      const next = event.target.value;
                      const numeric = /^[+\d][\d\s()-]*$/.test(next.trim()) && next.trim() !== "";
                      setIdentifier(numeric ? stripDial(next, signInDial) : next);
                    }}
                  />
                </div>
              </div>
              <PasswordField
                id="signin-password"
                label={t("auth.password")}
                value={password}
                onChange={setPassword}
              />
              <Button type="submit" className="w-full" disabled={busy}>
                {t("auth.signIn")}
              </Button>
              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-muted-foreground underline-offset-4 hover:underline"
              >
                {t("auth.forgot")}
              </button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field
                  id="signup-first"
                  label={t("auth.firstName")}
                  type="text"
                  autoComplete="given-name"
                  value={form.firstName}
                  onChange={setField("firstName")}
                />
                <Field
                  id="signup-last"
                  label={t("auth.lastName")}
                  type="text"
                  autoComplete="family-name"
                  value={form.lastName}
                  onChange={setField("lastName")}
                />
              </div>
              <Field
                id="signup-dob"
                label={t("auth.dob")}
                type="date"
                autoComplete="bday"
                value={form.dateOfBirth}
                onChange={setField("dateOfBirth")}
              />
              <Field
                id="signup-email"
                label={t("auth.email")}
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={setField("email")}
              />
              <PhoneField
                id="signup-phone"
                label={t("auth.phone")}
                countryLabel={t("auth.countryCode")}
                iso={signUpCountry}
                onIso={setSignUpCountry}
                value={form.phone}
                onChange={setField("phone")}
                autoComplete="tel"
                invalid={form.phone.length > 0 && !phoneValid}
              />
              {form.phone.length > 0 && !phoneValid ? (
                <p className="text-xs text-destructive">{phoneError}</p>
              ) : null}
              <div className="space-y-1.5">
                <label
                  htmlFor="signup-currency"
                  className="text-xs font-medium text-muted-foreground"
                >
                  {t("auth.currency")}
                </label>
                <select
                  id="signup-currency"
                  value={form.currency}
                  onChange={(event) => setField("currency")(event.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <option value="USD">USD — US Dollar ($)</option>
                  <option value="EUR">EUR — Euro (€)</option>
                  <option value="EGP">EGP — Egyptian Pound</option>
                </select>
                <p className="text-xs text-muted-foreground">{t("auth.currencyHint")}</p>
              </div>
              <PasswordField
                id="signup-password"
                label={t("auth.password")}
                autoComplete="new-password"
                value={form.password}
                onChange={setField("password")}
              />
              {form.password && problems.length > 0 ? (
                <p className="text-xs text-destructive">
                  {t("auth.passwordNeeds", { p: problems.join(", ") })}
                </p>
              ) : null}
              <PasswordField
                id="signup-confirm"
                label={t("auth.confirmPassword")}
                autoComplete="new-password"
                value={form.confirm}
                onChange={setField("confirm")}
              />
              {form.confirm && form.confirm !== form.password ? (
                <p className="text-xs text-destructive">{t("auth.passwordsMismatch")}</p>
              ) : null}
              <Button type="submit" className="w-full" disabled={busy || !phoneValid}>
                {t("auth.createAccount")}
              </Button>
              <p className="text-xs text-muted-foreground">{t("auth.ageNotice")}</p>
            </form>
          </TabsContent>
        </Tabs>

        <div className="my-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">{t("auth.or")}</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <div className="grid gap-3">
          <Button variant="outline" className="w-full" onClick={() => handleOAuth("google")} disabled={busy}>
            {t("auth.google")}
          </Button>
          <Button variant="outline" className="w-full" onClick={() => handleOAuth("apple")} disabled={busy}>
            {t("auth.apple")}
          </Button>
        </div>
    </AuthShell>
  );
}

/** Country-code select + local number box; the dial code can never be typed twice. */
function PhoneField({
  id,
  label,
  countryLabel,
  iso,
  onIso,
  value,
  onChange,
  autoComplete,
  invalid,
}: {
  id: string;
  label: string;
  countryLabel: string;
  iso: string;
  onIso: (iso: string) => void;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  invalid?: boolean;
}) {
  const dial = countryByIso(iso)?.dial ?? "+1";
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2" dir="ltr">
        <select
          aria-label={countryLabel}
          value={iso}
          onChange={(event) => {
            const next = event.target.value;
            onChange(stripDial(value, dial));
            onIso(next);
          }}
          className="h-10 w-32 shrink-0 rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {COUNTRIES.map((c) => (
            <option key={c.iso} value={c.iso}>
              {c.iso} {c.dial}
            </option>
          ))}
        </select>
        <Input
          id={id}
          type="tel"
          inputMode="numeric"
          value={value}
          autoComplete={autoComplete ?? "tel"}
          placeholder="100 000 0000"
          required
          aria-invalid={invalid ? true : undefined}
          {...(invalid ? { className: "border-destructive focus-visible:ring-destructive" } : {})}
          onChange={(event) => onChange(stripDial(event.target.value, dial))}
        />
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  type,
  value,
  onChange,
  autoComplete,
  placeholder,
}: {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete ?? "off"}
        placeholder={placeholder ?? ""}
        required
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete = "current-password",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);
  const { t } = useI18n();
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          autoComplete={autoComplete}
          required
          className="pr-10"
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? t("auth.hidePassword") : t("auth.showPassword")}
          className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground transition-colors hover:text-foreground"
        >
          {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
        </button>
      </div>
    </div>
  );
}