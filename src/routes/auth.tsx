import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { checkRegistration, resolveLoginIdentifier } from "@/lib/registration.functions";
import { passwordProblems } from "@/lib/password";
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

  const [identifier, setIdentifier] = useState("");
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
  const setField = (key: keyof typeof form) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const problems = passwordProblems(form.password);

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
      const { email } = await resolveLoginIdentifier({ data: { identifier } });
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      toast.success("Signed in");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign you in.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignUp(event: React.FormEvent) {
    event.preventDefault();
    if (problems.length > 0) {
      toast.error(`Password needs ${problems.join(", ")}.`);
      return;
    }
    if (form.password !== form.confirm) {
      toast.error("Passwords do not match.");
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
          phone: form.phone,
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
        toast.success("Verification code sent — check your email.");
      } else {
        toast.success("Account created");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create your account.");
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
      toast.error("Enter your email address to reset your password.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(identifier.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success("Password reset email sent");
  }

  if (pendingVerification) {
    return (
      <AuthShell>
        <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight">Verify your account</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          We sent a verification link to <span className="text-foreground">{pendingVerification}</span>.
          Open it to activate your AstroBet account, then come back here to sign in.
        </p>
        <Button className="mt-6 w-full" variant="outline" onClick={() => setPendingVerification(null)}>
          Back to sign in
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
        <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight">Account access</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in to your AstroBet account, or create one in under a minute.
        </p>

        <Tabs defaultValue={search.mode === "signup" ? "signup" : "signin"} className="mt-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign in</TabsTrigger>
            <TabsTrigger value="signup">Create account</TabsTrigger>
          </TabsList>

          <TabsContent value="signin">
            <form onSubmit={handleSignIn} className="space-y-4">
              <Field
                id="signin-identifier"
                label="Email or phone number"
                type="text"
                autoComplete="username"
                value={identifier}
                onChange={setIdentifier}
              />
              <PasswordField
                id="signin-password"
                label="Password"
                value={password}
                onChange={setPassword}
              />
              <Button type="submit" className="w-full" disabled={busy}>
                Sign in
              </Button>
              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-muted-foreground underline-offset-4 hover:underline"
              >
                Forgot password?
              </button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field
                  id="signup-first"
                  label="First name"
                  type="text"
                  autoComplete="given-name"
                  value={form.firstName}
                  onChange={setField("firstName")}
                />
                <Field
                  id="signup-last"
                  label="Last name"
                  type="text"
                  autoComplete="family-name"
                  value={form.lastName}
                  onChange={setField("lastName")}
                />
              </div>
              <Field
                id="signup-dob"
                label="Date of birth"
                type="date"
                autoComplete="bday"
                value={form.dateOfBirth}
                onChange={setField("dateOfBirth")}
              />
              <Field
                id="signup-email"
                label="Email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={setField("email")}
              />
              <Field
                id="signup-phone"
                label="Phone number"
                type="tel"
                autoComplete="tel"
                placeholder="+20 100 000 0000"
                value={form.phone}
                onChange={setField("phone")}
              />
              <div className="space-y-1.5">
                <label
                  htmlFor="signup-currency"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Account currency
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
                <p className="text-xs text-muted-foreground">
                  Your balances, bets and payouts are held in this currency.
                </p>
              </div>
              <PasswordField
                id="signup-password"
                label="Password"
                autoComplete="new-password"
                value={form.password}
                onChange={setField("password")}
              />
              {form.password && problems.length > 0 ? (
                <p className="text-xs text-destructive">Password needs {problems.join(", ")}.</p>
              ) : null}
              <PasswordField
                id="signup-confirm"
                label="Confirm password"
                autoComplete="new-password"
                value={form.confirm}
                onChange={setField("confirm")}
              />
              {form.confirm && form.confirm !== form.password ? (
                <p className="text-xs text-destructive">Passwords do not match.</p>
              ) : null}
              <Button type="submit" className="w-full" disabled={busy}>
                Create account
              </Button>
              <p className="text-xs text-muted-foreground">
                You must be of legal age in your jurisdiction to open an AstroBet account.
              </p>
            </form>
          </TabsContent>
        </Tabs>

        <div className="my-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <div className="grid gap-3">
          <Button variant="outline" className="w-full" onClick={() => handleOAuth("google")} disabled={busy}>
            Continue with Google
          </Button>
          <Button variant="outline" className="w-full" onClick={() => handleOAuth("apple")} disabled={busy}>
            Continue with Apple
          </Button>
        </div>
    </AuthShell>
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
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground transition-colors hover:text-foreground"
        >
          {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
        </button>
      </div>
    </div>
  );
}