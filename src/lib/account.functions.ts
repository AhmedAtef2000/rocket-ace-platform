import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Provisions the domain-side records for a freshly authenticated identity.
// Runs with service role because users/wallets are write-protected from clients.
export const provisionAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const email = typeof context.claims["email"] === "string" ? context.claims["email"] : "";
    const now = new Date().toISOString();
    const meta = (context.claims["user_metadata"] ?? {}) as Record<string, unknown>;
    const str = (key: string): string | null => {
      const value = meta[key];
      return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
    };
    const dateOfBirth = str("date_of_birth");
    const phone = str("phone");
    const primaryCurrency = (() => {
      const value = str("primary_currency");
      return value && ["USD", "EUR", "EGP"].includes(value.toUpperCase())
        ? value.toUpperCase()
        : "USD";
    })();

    const { error: userError } = await supabaseAdmin.from("users").upsert(
      {
        id: userId,
        email,
        status: "ACTIVE",
        demo_mode: true,
        play_mode: "DEMO",
        preferred_currency: primaryCurrency,
        real_money_enabled: false,
        last_login_at: now,
        email_verified_at: now,
        ...(dateOfBirth ? { date_of_birth: dateOfBirth } : {}),
      },
      { onConflict: "id" },
    );
    if (userError) throw new Error(userError.message);

    const { data: profile } = await supabaseAdmin
      .from("user_profiles")
      .select("id, first_name, last_name, phone")
      .eq("user_id", userId)
      .maybeSingle();
    if (!profile) {
      const { error } = await supabaseAdmin.from("user_profiles").insert({
        user_id: userId,
        first_name: str("first_name"),
        last_name: str("last_name"),
        phone,
      });
      if (error) throw new Error(error.message);
    } else if (!profile.first_name && (str("first_name") || phone)) {
      await supabaseAdmin
        .from("user_profiles")
        .update({ first_name: str("first_name"), last_name: str("last_name"), phone })
        .eq("id", profile.id);
    }

    const { data: limits } = await supabaseAdmin
      .from("responsible_gambling_limits")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!limits) {
      const { error } = await supabaseAdmin
        .from("responsible_gambling_limits")
        .insert({ user_id: userId });
      if (error) throw new Error(error.message);
    }

    const { data: demoWallet } = await supabaseAdmin
      .from("wallets")
      .select("id")
      .eq("user_id", userId)
      .eq("currency", "DEMO")
      .maybeSingle();
    if (!demoWallet) {
      const { error } = await supabaseAdmin.from("wallets").insert({
        user_id: userId,
        currency: "DEMO",
        kind: "DEMO",
        status: "ACTIVE",
      });
      if (error) throw new Error(error.message);
    }

    // Primary fiat wallet chosen at registration (USD/EUR/EGP).
    const { data: fiatWallet } = await supabaseAdmin
      .from("wallets")
      .select("id")
      .eq("user_id", userId)
      .eq("kind", "REAL")
      .maybeSingle();
    if (!fiatWallet) {
      const { error } = await supabaseAdmin.from("wallets").insert({
        user_id: userId,
        currency: primaryCurrency,
        kind: "REAL",
        status: "ACTIVE",
      });
      if (error) throw new Error(error.message);
    }

    return { ok: true as const };
  });

// Reads the signed-in user's own records through RLS (never the service role).
export const getAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [userRow, wallets, limits] = await Promise.all([
      supabase
        .from("users")
        .select(
          "id, email, account_number, status, demo_mode, play_mode, preferred_currency, real_money_enabled, mfa_enabled, created_at, last_login_at",
        )
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("wallets")
        .select("id, currency, kind, available_amount, locked_amount, status")
        .eq("user_id", userId)
        .order("currency", { ascending: true }),
      supabase
        .from("responsible_gambling_limits")
        .select("session_limit_minutes, cooling_off_until, self_exclusion_until")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    if (userRow.error) throw new Error(userRow.error.message);
    if (wallets.error) throw new Error(wallets.error.message);

    return {
      user: userRow.data,
      wallets: wallets.data ?? [],
      limits: limits.data ?? null,
    };
  });