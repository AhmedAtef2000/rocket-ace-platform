import { createServerFn } from "@tanstack/react-start";
import {
  isEmailLike,
  normalizeEmail,
  normalizePhone,
  parseRegistration,
} from "@/lib/registration.server";

/**
 * Pre-flight duplicate check before the client calls signUp.
 * Public by necessity (the visitor has no session yet) and rate limited.
 */
export const checkRegistration = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => parseRegistration(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { enforceRateLimit } = await import("@/lib/rate-limit.server");
    await enforceRateLimit(supabaseAdmin, "auth.register-check", data.email);

    const [emailRow, phoneRow] = await Promise.all([
      supabaseAdmin.from("users").select("id").eq("email", data.email).maybeSingle(),
      supabaseAdmin.from("user_profiles").select("id").eq("phone", data.phone).maybeSingle(),
    ]);

    if (emailRow.data) {
      return { ok: false as const, field: "email" as const, message: "That email is already registered. Try signing in instead." };
    }
    if (phoneRow.data) {
      return { ok: false as const, field: "phone" as const, message: "That phone number is already registered." };
    }
    return {
      ok: true as const,
      email: data.email,
      phone: data.phone,
      currency: data.currency,
    };
  });

/**
 * Sign-in accepts an email or a phone number. Phone numbers are resolved to the
 * account email server-side so the credential check stays with Supabase Auth.
 */
export const resolveLoginIdentifier = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const raw = String((data as { identifier?: unknown } | undefined)?.identifier ?? "").trim();
    if (!raw) throw new Error("Enter your email or phone number.");
    return isEmailLike(raw)
      ? { kind: "email" as const, value: normalizeEmail(raw) }
      : { kind: "phone" as const, value: normalizePhone(raw) };
  })
  .handler(async ({ data }) => {
    if (data.kind === "email") return { email: data.value };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { enforceRateLimit } = await import("@/lib/rate-limit.server");
    await enforceRateLimit(supabaseAdmin, "auth.resolve-phone", data.value);

    const { data: profile } = await supabaseAdmin
      .from("user_profiles")
      .select("user_id")
      .eq("phone", data.value)
      .maybeSingle();
    if (!profile) throw new Error("Incorrect phone number or password.");

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("email")
      .eq("id", profile.user_id)
      .maybeSingle();
    if (!user?.email) throw new Error("Incorrect phone number or password.");
    return { email: user.email };
  });