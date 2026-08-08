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

    const { error: userError } = await supabaseAdmin.from("users").upsert(
      {
        id: userId,
        email,
        status: "ACTIVE",
        demo_mode: true,
        last_login_at: now,
        email_verified_at: now,
      },
      { onConflict: "id" },
    );
    if (userError) throw new Error(userError.message);

    const { data: profile } = await supabaseAdmin
      .from("user_profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!profile) {
      const { error } = await supabaseAdmin.from("user_profiles").insert({ user_id: userId });
      if (error) throw new Error(error.message);
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
        .select("id, email, status, demo_mode, mfa_enabled, created_at, last_login_at")
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