import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  parseAdminProfileInput,
  parseManualDecision,
  parseSettingsInput,
  parseStatusInput,
  parseUserSearch,
} from "@/lib/backoffice.server";

export const getPlatformSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requirePermission } = await import("@/lib/admin.server");
    await requirePermission(supabaseAdmin, context.userId, "analytics.view");
    const { data, error } = await supabaseAdmin
      .from("platform_settings")
      .select("site_name, tagline, logo_url, support_email, house_edge_note, maintenance_mode, updated_at")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const updatePlatformSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseSettingsInput(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requirePermission, auditAdmin } = await import("@/lib/admin.server");
    const identity = await requirePermission(supabaseAdmin, context.userId, "admin.manage");
    const { error } = await supabaseAdmin
      .from("platform_settings")
      .update(data)
      .eq("id", true);
    if (error) throw new Error(error.message);
    await auditAdmin(supabaseAdmin, {
      actorId: context.userId,
      actorRole: identity.roleKey,
      action: "settings.updated",
      resourceType: "platform_settings",
      metadata: data,
    });
    return { ok: true };
  });

export const searchUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ({ query: parseUserSearch(data) }))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requirePermission } = await import("@/lib/admin.server");
    await requirePermission(supabaseAdmin, context.userId, "user.view");

    const term = data.query;
    const isFullUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(term);
    const isPartialUuid = /^[0-9a-f-]{4,36}$/i.test(term);
    const isDigits = /^[0-9]{3,}$/.test(term);

    const byUser = supabaseAdmin
      .from("users")
      .select("id, account_number, email, status, country_code, created_at, last_login_at")
      .limit(20);

    let users:
      | {
          id: string;
          account_number: string | null;
          email: string;
          status: string;
          country_code: string | null;
          created_at: string;
          last_login_at: string | null;
        }[]
      | null = null;
    let error: { message: string } | null = null;

    if (isDigits) {
      const result = await byUser.ilike("account_number", `%${term}%`);
      users = result.data;
      error = result.error;
    } else if (isFullUuid) {
      const result = await byUser.eq("id", term);
      users = result.data;
      error = result.error;
    } else if (isPartialUuid) {
      const result = await byUser.or(
        `email.ilike.%${term}%,id.ilike.%${term}%,account_number.ilike.%${term}%`,
      );
      users = result.data;
      error = result.error;
    } else {
      const result = await byUser.or(`email.ilike.%${term}%,account_number.ilike.%${term}%`);
      users = result.data;
      error = result.error;
    }

    let rows = error ? [] : (users ?? []);

    if (rows.length === 0) {
      const { data: profiles } = await supabaseAdmin
        .from("user_profiles")
        .select("user_id")
        .or(`phone.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%`)
        .limit(20);
      const ids = (profiles ?? []).map((p) => p.user_id);
      if (ids.length) {
        const { data: matched } = await supabaseAdmin
          .from("users")
          .select("id, account_number, email, status, country_code, created_at, last_login_at")
          .in("id", ids);
        rows = matched ?? [];
      }
    }

    const ids = rows.map((r) => r.id);
    const { data: profiles } = ids.length
      ? await supabaseAdmin
          .from("user_profiles")
          .select("user_id, first_name, last_name, phone")
          .in("user_id", ids)
      : { data: [] as { user_id: string; first_name: string | null; last_name: string | null; phone: string | null }[] };

    return rows.map((r) => {
      const p = (profiles ?? []).find((x) => x.user_id === r.id);
      return {
        ...r,
        accountNumber: r.account_number ?? null,
        firstName: p?.first_name ?? null,
        lastName: p?.last_name ?? null,
        phone: p?.phone ?? null,
      };
    });
  });

export const getUserDossier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const id = (data as { userId?: unknown })?.userId;
    if (typeof id !== "string" || !id) throw new Error("Missing user.");
    return { userId: id };
  })
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requirePermission, num } = await import("@/lib/admin.server");
    const { signedUrl } = await import("@/lib/backoffice.server");
    await requirePermission(supabaseAdmin, context.userId, "user.view");
    const userId = data.userId;

    const [user, profile, wallets, bets, deposits, withdrawals, kycCase, docs, manual] =
      await Promise.all([
        supabaseAdmin
          .from("users")
          .select("id, account_number, email, status, country_code, date_of_birth, created_at, last_login_at")
          .eq("id", userId)
          .maybeSingle(),
        supabaseAdmin
          .from("user_profiles")
          .select("first_name, last_name, phone, address_line_1, city, postal_code")
          .eq("user_id", userId)
          .maybeSingle(),
        supabaseAdmin
          .from("wallets")
          .select("id, currency, kind, available_amount, locked_amount, status")
          .eq("user_id", userId),
        supabaseAdmin
          .from("bets")
          .select("id, amount, payout_amount, status, cashout_multiplier, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(25),
        supabaseAdmin
          .from("deposits")
          .select("id, currency, status, confirmed_amount, requested_amount, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(15),
        supabaseAdmin
          .from("withdrawals")
          .select("id, currency, amount, status, requested_at")
          .eq("user_id", userId)
          .order("requested_at", { ascending: false })
          .limit(15),
        supabaseAdmin
          .from("kyc_cases")
          .select("id, status, risk_level, submitted_at, rejection_reason")
          .eq("user_id", userId)
          .order("submitted_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabaseAdmin
          .from("kyc_documents")
          .select("id, doc_type, file_name, status, storage_path, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(20),
        supabaseAdmin
          .from("manual_deposit_requests")
          .select("id, method, amount, currency, status, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

    if (!user.data) throw new Error("User not found.");

    const betRows = bets.data ?? [];
    const wagered = betRows.reduce((s, b) => s + num(b.amount), 0);
    const returned = betRows.reduce((s, b) => s + num(b.payout_amount), 0);

    const documents = await Promise.all(
      (docs.data ?? []).map(async (d) => ({
        id: d.id,
        docType: d.doc_type,
        fileName: d.file_name,
        status: d.status,
        createdAt: d.created_at,
        url: await signedUrl(supabaseAdmin, "kyc-documents", d.storage_path),
      })),
    );

    return {
      user: user.data,
      profile: profile.data,
      wallets: wallets.data ?? [],
      bets: betRows,
      stats: { bets: betRows.length, wagered, returned, net: returned - wagered },
      deposits: deposits.data ?? [],
      withdrawals: withdrawals.data ?? [],
      kycCase: kycCase.data,
      documents,
      manualDeposits: manual.data ?? [],
    };
  });

export const setUserStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseStatusInput(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requirePermission, auditAdmin } = await import("@/lib/admin.server");
    const { notify } = await import("@/lib/support.server");
    const identity = await requirePermission(supabaseAdmin, context.userId, "user.suspend");
    if (data.userId === context.userId) throw new Error("You cannot change your own status.");

    const { error } = await supabaseAdmin
      .from("users")
      .update({ status: data.status })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);

    await notify(
      supabaseAdmin,
      data.userId,
      "account.status",
      data.status === "ACTIVE" ? "Account reinstated" : "Account status changed",
      data.note ?? `Your account status is now ${data.status.replace(/_/g, " ").toLowerCase()}.`,
    );
    await auditAdmin(supabaseAdmin, {
      actorId: context.userId,
      actorRole: identity.roleKey,
      action: "user.status_changed",
      resourceType: "users",
      resourceId: data.userId,
      metadata: { status: data.status, note: data.note },
    });
    return { ok: true };
  });

export const adminUpdateUserProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseAdminProfileInput(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requirePermission, auditAdmin } = await import("@/lib/admin.server");
    const identity = await requirePermission(supabaseAdmin, context.userId, "user.suspend");

    const { error } = await supabaseAdmin
      .from("user_profiles")
      .upsert({ user_id: data.userId, ...data.profile }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);

    if (data.dateOfBirth || data.countryCode) {
      const patch: { date_of_birth?: string; country_code?: string } = {};
      if (data.dateOfBirth) patch.date_of_birth = data.dateOfBirth;
      if (data.countryCode) patch.country_code = data.countryCode;
      const { error: userError } = await supabaseAdmin.from("users").update(patch).eq("id", data.userId);
      if (userError) throw new Error(userError.message);
    }

    await auditAdmin(supabaseAdmin, {
      actorId: context.userId,
      actorRole: identity.roleKey,
      action: "user.profile_edited",
      resourceType: "user_profiles",
      resourceId: data.userId,
      metadata: { ...data.profile },
    });
    return { ok: true };
  });

export const setUserRealMoneyEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseRealMoneyToggle(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requirePermission, auditAdmin } = await import("@/lib/admin.server");
    const { notify } = await import("@/lib/support.server");
    const identity = await requirePermission(supabaseAdmin, context.userId, "user.suspend");
    if (data.userId === context.userId) throw new Error("You cannot change your own real-money flag.");

    const { error } = await supabaseAdmin
      .from("users")
      .update({ real_money_enabled: data.enabled })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);

    await notify(
      supabaseAdmin,
      data.userId,
      "account.real_money",
      data.enabled ? "Real-money play enabled" : "Real-money play disabled",
      data.note ?? `Real-money play is now ${data.enabled ? "enabled" : "disabled"} for your account.`,
    );
    await auditAdmin(supabaseAdmin, {
      actorId: context.userId,
      actorRole: identity.roleKey,
      action: "user.real_money_toggled",
      resourceType: "users",
      resourceId: data.userId,
      metadata: { enabled: data.enabled, note: data.note },
    });
    return { ok: true, enabled: data.enabled };
  });

export const setGlobalRealMoneyLive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseGlobalFlagToggle(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireRole, auditAdmin } = await import("@/lib/admin.server");
    const identity = await requireRole(supabaseAdmin, context.userId, "SUPER_ADMIN");

    const { error } = await supabaseAdmin
      .from("platform_settings")
      .update({ is_real_money_live: data.value })
      .eq("id", true);
    if (error) throw new Error(error.message);

    await auditAdmin(supabaseAdmin, {
      actorId: context.userId,
      actorRole: identity.roleKey,
      action: "platform.real_money_live_toggled",
      resourceType: "platform_settings",
      resourceId: "global",
      metadata: { is_real_money_live: data.value },
    });
    return { ok: true, value: data.value };
  });

export const listManualDeposits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requirePermission } = await import("@/lib/admin.server");
    const { signedUrl } = await import("@/lib/backoffice.server");
    await requirePermission(supabaseAdmin, context.userId, "finance.view");

    const { data, error } = await supabaseAdmin
      .from("manual_deposit_requests")
      .select(
        "id, user_id, method, currency, amount, sender_number, reference, status, proof_path, proof_name, review_note, created_at",
      )
      .eq("status", "PENDING")
      .order("created_at", { ascending: true })
      .limit(50);
    if (error) throw new Error(error.message);

    return Promise.all(
      (data ?? []).map(async (row) => ({
        ...row,
        proofUrl: await signedUrl(supabaseAdmin, "payment-proofs", row.proof_path),
      })),
    );
  });

export const decideManualDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseManualDecision(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requirePermission, auditAdmin, num } = await import("@/lib/admin.server");
    const { notify } = await import("@/lib/support.server");
    const { creditDeposit, ensureRealWallet, MANUAL_PROVIDER_ID } = await import(
      "@/lib/payments.server"
    );
    const identity = await requirePermission(supabaseAdmin, context.userId, "withdrawal.approve");

    const { data: request, error } = await supabaseAdmin
      .from("manual_deposit_requests")
      .select("id, user_id, method, currency, amount, status, credited_deposit_id")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!request) throw new Error("Request not found.");
    if (request.status !== "PENDING") throw new Error("This request was already reviewed.");

    const now = new Date().toISOString();

    if (data.decision === "REJECTED") {
      await supabaseAdmin
        .from("manual_deposit_requests")
        .update({
          status: "REJECTED",
          reviewed_by: context.userId,
          reviewed_at: now,
          review_note: data.note,
        })
        .eq("id", request.id);
      await notify(
        supabaseAdmin,
        request.user_id,
        "deposit.rejected",
        "Deposit rejected",
        data.note ?? "We could not verify your transfer receipt. Please contact support.",
      );
    } else {
      const wallet = await ensureRealWallet(supabaseAdmin, request.user_id, request.currency);
      const amount = num(request.amount);
      const { data: deposit, error: depositError } = await supabaseAdmin
        .from("deposits")
        .insert({
          user_id: request.user_id,
          wallet_id: wallet.id,
          currency: request.currency,
          network: request.method,
          provider: MANUAL_PROVIDER_ID,
          provider_transaction_id: request.id,
          requested_amount: amount,
          required_confirmations: 1,
          status: "PENDING",
        })
        .select("id")
        .single();
      if (depositError) throw new Error(depositError.message);

      await creditDeposit(supabaseAdmin, deposit.id, amount, 1);

      await supabaseAdmin
        .from("manual_deposit_requests")
        .update({
          status: "APPROVED",
          reviewed_by: context.userId,
          reviewed_at: now,
          review_note: data.note,
          credited_deposit_id: deposit.id,
        })
        .eq("id", request.id);
    }

    await auditAdmin(supabaseAdmin, {
      actorId: context.userId,
      actorRole: identity.roleKey,
      action: `deposit.manual_${data.decision.toLowerCase()}`,
      resourceType: "manual_deposit_requests",
      resourceId: request.id,
      metadata: { note: data.note },
    });
    return { ok: true };
  });

export const decideKycDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseManualDecision(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requirePermission, auditAdmin } = await import("@/lib/admin.server");
    const identity = await requirePermission(supabaseAdmin, context.userId, "kyc.decide");
    const { error } = await supabaseAdmin
      .from("kyc_documents")
      .update({
        status: data.decision,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
        review_note: data.note,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await auditAdmin(supabaseAdmin, {
      actorId: context.userId,
      actorRole: identity.roleKey,
      action: "kyc.document_reviewed",
      resourceType: "kyc_documents",
      resourceId: data.id,
      metadata: { decision: data.decision, note: data.note },
    });
    return { ok: true };
  });
