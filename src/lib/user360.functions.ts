import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  parseListInput,
  parseReasonAction,
  parseUserId,
} from "@/lib/user360.server";

/** Header identity block plus the caller's effective permissions. */
export const getUser360Header = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseUserId(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requirePermission } = await import("@/lib/admin.server");
    const { userHeader } = await import("@/lib/user360.server");
    const identity = await requirePermission(supabaseAdmin, context.userId, "user.view");
    return {
      header: await userHeader(supabaseAdmin, data.userId),
      permissions: identity.permissions,
      roleKey: identity.roleKey,
    };
  });

export const getUser360Summary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseUserId(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requirePermission } = await import("@/lib/admin.server");
    const { userSummary } = await import("@/lib/user360.server");
    await requirePermission(supabaseAdmin, context.userId, "user.view");
    return userSummary(supabaseAdmin, data.userId);
  });

export const getUser360Bets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseListInput(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requirePermission } = await import("@/lib/admin.server");
    const { userBets } = await import("@/lib/user360.server");
    await requirePermission(supabaseAdmin, context.userId, "user.view");
    return userBets(supabaseAdmin, data);
  });

export const getUser360Transactions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseListInput(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requirePermission } = await import("@/lib/admin.server");
    const { userTransactions } = await import("@/lib/user360.server");
    await requirePermission(supabaseAdmin, context.userId, "finance.view");
    return userTransactions(supabaseAdmin, data);
  });

export const getUser360Kyc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseUserId(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAny, userKyc } = await import("@/lib/user360.server");
    const identity = await requireAny(supabaseAdmin, context.userId, ["kyc.view", "kyc.decide"]);
    // Only reviewers with an explicit KYC permission ever receive signed document links.
    const canSeeDocuments =
      identity.permissions.includes("kyc.decide") || identity.permissions.includes("kyc.view");
    return userKyc(supabaseAdmin, data.userId, canSeeDocuments);
  });

export const getUser360Security = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseUserId(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAny, userSecurity } = await import("@/lib/user360.server");
    await requireAny(supabaseAdmin, context.userId, ["risk.view", "user.suspend", "audit.view"]);
    return userSecurity(supabaseAdmin, data.userId);
  });

export const getUser360Risk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseUserId(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requirePermission } = await import("@/lib/admin.server");
    const { userRisk } = await import("@/lib/user360.server");
    await requirePermission(supabaseAdmin, context.userId, "risk.view");
    return userRisk(supabaseAdmin, data.userId);
  });

export const getUser360Responsible = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseUserId(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requirePermission } = await import("@/lib/admin.server");
    const { userResponsible } = await import("@/lib/user360.server");
    await requirePermission(supabaseAdmin, context.userId, "user.view");
    return userResponsible(supabaseAdmin, data.userId);
  });

export const getUser360Support = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseUserId(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requirePermission } = await import("@/lib/admin.server");
    const { userSupport } = await import("@/lib/user360.server");
    await requirePermission(supabaseAdmin, context.userId, "support.view");
    return userSupport(supabaseAdmin, data.userId);
  });

export const getUser360Activity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseUserId(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requirePermission } = await import("@/lib/admin.server");
    const { userActivity } = await import("@/lib/user360.server");
    await requirePermission(supabaseAdmin, context.userId, "user.view");
    return userActivity(supabaseAdmin, data.userId);
  });

/* ------------------------------- notes -------------------------------- */

const NOTE_WRITE = ["user.suspend", "support.reply", "kyc.decide", "admin.manage"];

export const listUser360Notes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseUserId(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requirePermission } = await import("@/lib/admin.server");
    const identity = await requirePermission(supabaseAdmin, context.userId, "user.view");
    const { data: rows, error } = await supabaseAdmin
      .from("admin_user_notes")
      .select("id, body, author_id, author_role, created_at, updated_at")
      .eq("user_id", data.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return {
      notes: rows ?? [],
      canWrite: NOTE_WRITE.some((p) => identity.permissions.includes(p)),
    };
  });

export const saveUser360Note = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const d = (data ?? {}) as Record<string, unknown>;
    const body = typeof d["body"] === "string" ? d["body"].trim().slice(0, 2000) : "";
    if (!body) throw new Error("The note cannot be empty.");
    const id = typeof d["id"] === "string" ? d["id"] : null;
    return { ...parseUserId(d), body, id };
  })
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { auditAdmin } = await import("@/lib/admin.server");
    const { requireAny } = await import("@/lib/user360.server");
    const identity = await requireAny(supabaseAdmin, context.userId, NOTE_WRITE);

    if (data.id) {
      const { error } = await supabaseAdmin
        .from("admin_user_notes")
        .update({ body: data.body })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("admin_user_notes").insert({
        user_id: data.userId,
        author_id: context.userId,
        author_role: identity.roleKey,
        body: data.body,
      });
      if (error) throw new Error(error.message);
    }

    await auditAdmin(supabaseAdmin, {
      actorId: context.userId,
      actorRole: identity.roleKey,
      action: data.id ? "user.note_edited" : "user.note_added",
      resourceType: "admin_user_notes",
      resourceId: data.userId,
      metadata: { noteId: data.id },
    });
    return { ok: true as const };
  });

export const deleteUser360Note = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const id = (data as { id?: unknown })?.id;
    if (typeof id !== "string" || !id) throw new Error("Missing note.");
    return { id };
  })
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { auditAdmin } = await import("@/lib/admin.server");
    const { requireAny } = await import("@/lib/user360.server");
    const identity = await requireAny(supabaseAdmin, context.userId, NOTE_WRITE);
    const { error } = await supabaseAdmin.from("admin_user_notes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await auditAdmin(supabaseAdmin, {
      actorId: context.userId,
      actorRole: identity.roleKey,
      action: "user.note_deleted",
      resourceType: "admin_user_notes",
      resourceId: data.id,
    });
    return { ok: true as const };
  });

/* ------------------------------ actions ------------------------------- */

const STATUS_ACTIONS: Record<string, string> = {
  suspend: "SUSPENDED",
  unsuspend: "ACTIVE",
  restrict: "RESTRICTED",
  restrict_betting: "RESTRICTED",
  restrict_withdrawals: "RESTRICTED",
  close: "CLOSED",
};

/**
 * Server-authoritative account actions. Every call is permission-checked,
 * needs a reason, and writes an immutable audit entry. Nothing here can touch
 * settled bets, crash points or payouts.
 */
export const runUser360Action = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseReasonAction(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { auditAdmin } = await import("@/lib/admin.server");
    const { requireAny } = await import("@/lib/user360.server");
    const { notify } = await import("@/lib/support.server");
    const { enforceAction, forceLogout, applyAccountFlags } = await import(
      "@/lib/account-enforcement.server"
    );

    if (data.userId === context.userId) throw new Error("You cannot action your own account.");
    const now = new Date().toISOString();

    const permissionFor: Record<string, string[]> = {
      force_logout: ["user.suspend", "risk.resolve"],
      require_kyc: ["kyc.decide"],
      require_verification: ["kyc.decide", "user.suspend"],
      security_review: ["risk.resolve", "user.suspend"],
      message: ["support.reply"],
    };
    const identity = await requireAny(
      supabaseAdmin,
      context.userId,
      permissionFor[data.action] ?? ["user.suspend"],
    );

    if (data.action in STATUS_ACTIONS) {
      const status = STATUS_ACTIONS[data.action]!;
      await enforceAction(supabaseAdmin, data.userId, data.action);
      await notify(
        supabaseAdmin,
        data.userId,
        "account.status",
        status === "ACTIVE" ? "Account reinstated" : "Account status changed",
        data.reason ?? `Your account status is now ${status.toLowerCase()}.`,
      );
    } else if (data.action === "force_logout") {
      await forceLogout(supabaseAdmin, data.userId);
      await notify(
        supabaseAdmin,
        data.userId,
        "account.security",
        "You were signed out",
        data.reason ?? "Your sessions were ended by our security team.",
      );
    } else if (data.action === "require_kyc" || data.action === "require_verification") {
      const { data: kycCase } = await supabaseAdmin
        .from("kyc_cases")
        .select("id")
        .eq("user_id", data.userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (kycCase) {
        await supabaseAdmin
          .from("kyc_cases")
          .update({
            status: "REQUIRES_INFORMATION",
            reviewer_id: context.userId,
            reviewed_at: now,
            rejection_reason: data.reason,
          })
          .eq("id", kycCase.id);
      }
      // Verification is a hard gate: block real-money play until it clears.
      await applyAccountFlags(supabaseAdmin, data.userId, {
        real_money_enabled: false,
        withdrawals_blocked: true,
      });
      await notify(
        supabaseAdmin,
        data.userId,
        "kyc.required",
        "Additional verification required",
        data.reason ?? "Please complete identity verification to continue.",
      );
    } else if (data.action === "security_review") {
      const { error } = await supabaseAdmin.from("risk_events").insert({
        user_id: data.userId,
        event_type: "account.security_review",
        risk_score: 60,
        severity: "HIGH",
        status: "OPEN",
        source: "BACKOFFICE",
        description: data.reason ?? "Manual security review requested by staff.",
      });
      if (error) throw new Error(error.message);
      // A security review freezes payouts and ends live sessions.
      await applyAccountFlags(supabaseAdmin, data.userId, { withdrawals_blocked: true });
      await forceLogout(supabaseAdmin, data.userId);
      await notify(
        supabaseAdmin,
        data.userId,
        "account.security",
        "Security review opened",
        data.reason ?? "Withdrawals are paused while our team reviews your account.",
      );
    } else if (data.action === "message") {
      if (!data.reason) throw new Error("Write a message first.");
      await notify(supabaseAdmin, data.userId, "support.message", "Message from support", data.reason);
    } else {
      throw new Error("Unknown action.");
    }

    await auditAdmin(supabaseAdmin, {
      actorId: context.userId,
      actorRole: identity.roleKey,
      action: `user.${data.action}`,
      resourceType: "users",
      resourceId: data.userId,
      metadata: { reason: data.reason, at: now },
    });
    return { ok: true as const };
  });

export const decideUser360Kyc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const d = (data ?? {}) as Record<string, unknown>;
    const decision = typeof d["decision"] === "string" ? d["decision"] : "";
    if (!["APPROVED", "REJECTED", "REQUIRES_INFORMATION"].includes(decision)) {
      throw new Error("Unknown KYC decision.");
    }
    const reason = typeof d["reason"] === "string" ? d["reason"].trim().slice(0, 500) : "";
    return { ...parseUserId(d), decision, reason: reason || null };
  })
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requirePermission, auditAdmin } = await import("@/lib/admin.server");
    const { notify } = await import("@/lib/support.server");
    const identity = await requirePermission(supabaseAdmin, context.userId, "kyc.decide");
    const now = new Date().toISOString();

    const { data: kycCase } = await supabaseAdmin
      .from("kyc_cases")
      .select("id")
      .eq("user_id", data.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const patch = {
      status: data.decision as never,
      reviewer_id: context.userId,
      reviewed_at: now,
      rejection_reason: data.reason,
    };

    if (kycCase) {
      const { error } = await supabaseAdmin.from("kyc_cases").update(patch).eq("id", kycCase.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("kyc_cases")
        .insert({ user_id: data.userId, provider: "MANUAL", ...patch });
      if (error) throw new Error(error.message);
    }

    await notify(
      supabaseAdmin,
      data.userId,
      "kyc.decision",
      "Verification update",
      data.reason ?? `Your verification is now ${data.decision.replace(/_/g, " ").toLowerCase()}.`,
    );
    await auditAdmin(supabaseAdmin, {
      actorId: context.userId,
      actorRole: identity.roleKey,
      action: "kyc.case_decided",
      resourceType: "kyc_cases",
      resourceId: data.userId,
      metadata: { decision: data.decision, reason: data.reason },
    });
    return { ok: true as const };
  });