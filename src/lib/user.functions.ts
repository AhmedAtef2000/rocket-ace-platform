import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  audit,
  deviceLabelFrom,
  isActive,
  isoInDays,
  parseProfileInput,
  parseRgInput,
  requireUuid,
  splitLimitChanges,
} from "@/lib/user-management.server";

export const getUserManagement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [user, profile, limits, sessions] = await Promise.all([
      supabase
        .from("users")
        .select(
          "id, email, status, demo_mode, mfa_enabled, country_code, date_of_birth, email_verified_at, created_at, last_login_at",
        )
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("user_profiles")
        .select(
          "first_name, last_name, phone, address_line_1, address_line_2, city, postal_code",
        )
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("responsible_gambling_limits")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("user_sessions")
        .select("id, device_label, user_agent, created_at, last_seen_at, revoked_at")
        .eq("user_id", userId)
        .order("last_seen_at", { ascending: false })
        .limit(25),
    ]);

    if (user.error) throw new Error(user.error.message);

    return {
      user: user.data,
      profile: profile.data ?? null,
      limits: limits.data ?? null,
      sessions: sessions.data ?? [],
      locked: {
        coolingOff: isActive(limits.data?.cooling_off_until ?? null),
        selfExcluded: isActive(limits.data?.self_exclusion_until ?? null),
      },
    };
  });

export const getProfileOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [userRow, profile, wallets, bets, cashouts, kyc] = await Promise.all([
      supabase
        .from("users")
        .select("id, email, account_number, status, mfa_enabled, created_at, last_login_at")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("user_profiles")
        .select("first_name, last_name")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("wallets")
        .select("currency, kind, available_amount, locked_amount")
        .eq("user_id", userId),
      supabase.from("bets").select("amount, payout_amount, status").eq("user_id", userId),
      supabase
        .from("cashouts")
        .select("multiplier")
        .eq("user_id", userId)
        .order("multiplier", { ascending: false })
        .limit(1),
      supabase
        .from("kyc_cases")
        .select("status, reviewed_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1),
    ]);

    const betRows = bets.data ?? [];
    const staked = betRows.reduce((sum, b) => sum + Number(b.amount ?? 0), 0);
    const returned = betRows.reduce((sum, b) => sum + Number(b.payout_amount ?? 0), 0);
    const real = (wallets.data ?? []).filter((w) => w.kind !== "DEMO");

    return {
      user: userRow.data,
      profile: profile.data ?? null,
      balance: {
        currency: real[0]?.currency ?? "USD",
        available: real.reduce((s, w) => s + Number(w.available_amount ?? 0), 0),
        locked: real.reduce((s, w) => s + Number(w.locked_amount ?? 0), 0),
      },
      stats: {
        lifetimeBets: betRows.length,
        highestMultiplier: Number(cashouts.data?.[0]?.multiplier ?? 0),
        totalProfit: returned - staked,
        totalStaked: staked,
      },
      kyc: { status: kyc.data?.[0]?.status ?? "NOT_STARTED", reviewedAt: kyc.data?.[0]?.reviewed_at ?? null },
    };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseProfileInput(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Identity fields (name, phone) are KYC-relevant: writable only while unset.
    // Once captured at registration they can only change through a support
    // ticket with proof, never by self-service.
    const { data: existingProfile } = await supabase
      .from("user_profiles")
      .select("first_name, last_name, phone")
      .eq("user_id", userId)
      .maybeSingle();

    const patch: {
      address_line_1: string | null;
      address_line_2: string | null;
      city: string | null;
      postal_code: string | null;
      first_name?: string | null;
      last_name?: string | null;
      phone?: string | null;
    } = {
      address_line_1: data.address_line_1,
      address_line_2: data.address_line_2,
      city: data.city,
      postal_code: data.postal_code,
    };
    if (!existingProfile?.first_name) patch.first_name = data.first_name;
    if (!existingProfile?.last_name) patch.last_name = data.last_name;
    if (!existingProfile?.phone) patch.phone = data.phone;

    const { error: profileError } = await supabase
      .from("user_profiles")
      .update(patch)
      .eq("user_id", userId);
    if (profileError) throw new Error(profileError.message);

    // Identity fields are KYC-relevant: writable only until they are set.
    const { data: current } = await supabaseAdmin
      .from("users")
      .select("country_code, date_of_birth")
      .eq("id", userId)
      .maybeSingle();

    const identityPatch: { country_code?: string; date_of_birth?: string } = {};
    if (!current?.country_code && data.country_code) identityPatch.country_code = data.country_code;
    if (!current?.date_of_birth && data.date_of_birth) identityPatch.date_of_birth = data.date_of_birth;

    if (Object.keys(identityPatch).length > 0) {
      const { error } = await supabaseAdmin.from("users").update(identityPatch).eq("id", userId);
      if (error) throw new Error(error.message);
    }

    await audit(supabaseAdmin, {
      actorId: userId,
      action: "profile.updated",
      metadata: { identity_fields_set: Object.keys(identityPatch) },
    });

    return {
      ok: true as const,
      identityLocked: {
        country: !!(current?.country_code ?? identityPatch.country_code),
        dateOfBirth: !!(current?.date_of_birth ?? identityPatch.date_of_birth),
      },
    };
  });

export const updateResponsibleGamblingLimits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseRgInput(data))
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: current, error } = await supabaseAdmin
      .from("responsible_gambling_limits")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!current) throw new Error("Responsible gambling record missing.");

    const { applied, rejected } = splitLimitChanges(
      current as unknown as Record<string, number | null>,
      data,
    );

    if (Object.keys(applied).length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from("responsible_gambling_limits")
        .update(applied)
        .eq("user_id", userId);
      if (updateError) throw new Error(updateError.message);

      await audit(supabaseAdmin, {
        actorId: userId,
        action: "rg.limits.tightened",
        resourceType: "responsible_gambling_limits",
        metadata: { applied },
      });
    }

    return { applied, rejected };
  });

export const startCoolingOff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const days = Number((data as { days?: unknown } | undefined)?.days);
    if (![1, 7, 30].includes(days)) throw new Error("Choose a 1, 7 or 30 day cooling-off period.");
    return { days };
  })
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: current } = await supabaseAdmin
      .from("responsible_gambling_limits")
      .select("cooling_off_until")
      .eq("user_id", userId)
      .maybeSingle();

    const next = isoInDays(data.days);
    const existing = current?.cooling_off_until ?? null;
    // Never allow shortening an active cooling-off period.
    const until = existing && new Date(existing) > new Date(next) ? existing : next;

    const { error } = await supabaseAdmin
      .from("responsible_gambling_limits")
      .update({ cooling_off_until: until })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);

    await audit(supabaseAdmin, {
      actorId: userId,
      action: "rg.cooling_off.started",
      resourceType: "responsible_gambling_limits",
      metadata: { until, requested_days: data.days },
    });

    return { until };
  });

export const startSelfExclusion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const months = Number((data as { months?: unknown } | undefined)?.months);
    if (![6, 12, 60].includes(months)) throw new Error("Choose a 6, 12 or 60 month exclusion.");
    return { months };
  })
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: current } = await supabaseAdmin
      .from("responsible_gambling_limits")
      .select("self_exclusion_until")
      .eq("user_id", userId)
      .maybeSingle();

    const next = isoInDays(data.months * 30);
    const existing = current?.self_exclusion_until ?? null;
    const until = existing && new Date(existing) > new Date(next) ? existing : next;

    const { error } = await supabaseAdmin
      .from("responsible_gambling_limits")
      .update({ self_exclusion_until: until })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);

    const { error: statusError } = await supabaseAdmin
      .from("users")
      .update({ status: "SELF_EXCLUDED" })
      .eq("id", userId);
    if (statusError) throw new Error(statusError.message);

    await supabaseAdmin
      .from("user_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("revoked_at", null);

    await audit(supabaseAdmin, {
      actorId: userId,
      action: "rg.self_exclusion.started",
      resourceType: "responsible_gambling_limits",
      metadata: { until, requested_months: data.months },
    });

    return { until };
  });

export const registerSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const d = (data ?? {}) as { deviceId?: unknown; userAgent?: unknown };
    return {
      deviceId: requireUuid(d.deviceId, "device id"),
      userAgent: typeof d.userAgent === "string" ? d.userAgent.slice(0, 400) : null,
    };
  })
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();

    const { data: existing } = await supabaseAdmin
      .from("user_sessions")
      .select("id, user_id, revoked_at")
      .eq("id", data.deviceId)
      .maybeSingle();

    // The device id lives in browser storage, so a second account signing in on
    // the same browser will collide with it. Issue a fresh id instead of failing.
    const sessionId =
      existing && existing.user_id !== userId ? crypto.randomUUID() : data.deviceId;

    if (existing && existing.user_id === userId && existing.revoked_at) {
      return { revoked: true as const, deviceId: sessionId };
    }

    const { error } = await supabaseAdmin.from("user_sessions").upsert(
      {
        id: sessionId,
        user_id: userId,
        device_label: deviceLabelFrom(data.userAgent),
        user_agent: data.userAgent,
        last_seen_at: now,
      },
      { onConflict: "id" },
    );
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("users").update({ last_login_at: now }).eq("id", userId);

    return { revoked: false as const, deviceId: sessionId };
  });

export const revokeSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ({
    sessionId: requireUuid((data as { sessionId?: unknown } | undefined)?.sessionId, "session id"),
  }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("user_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.sessionId)
      .eq("user_id", userId)
      .is("revoked_at", null);
    if (error) throw new Error(error.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await audit(supabaseAdmin, {
      actorId: userId,
      action: "session.revoked",
      resourceType: "user_sessions",
      resourceId: data.sessionId,
    });

    return { ok: true as const };
  });

export const revokeOtherSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ({
    keepId: requireUuid((data as { keepId?: unknown } | undefined)?.keepId, "device id"),
  }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("user_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("user_id", userId)
      .neq("id", data.keepId)
      .is("revoked_at", null);
    if (error) throw new Error(error.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await audit(supabaseAdmin, {
      actorId: userId,
      action: "session.revoked_others",
      resourceType: "user_sessions",
      resourceId: data.keepId,
    });

    return { ok: true as const };
  });

export const syncMfaStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ({
    enabled: Boolean((data as { enabled?: unknown } | undefined)?.enabled),
  }))
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Trust the identity provider, not the caller: read the real factor state.
    const { data: factors, error } = await supabaseAdmin.auth.admin.mfa.listFactors({ userId });
    if (error) throw new Error(error.message);
    const enabled = (factors?.factors ?? []).some((f) => f.status === "verified");

    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({ mfa_enabled: enabled })
      .eq("id", userId);
    if (updateError) throw new Error(updateError.message);

    await audit(supabaseAdmin, {
      actorId: userId,
      action: enabled ? "mfa.enabled" : "mfa.disabled",
      metadata: { requested: data.enabled },
    });

    return { enabled };
  });
