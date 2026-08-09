import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseDecision } from "@/lib/admin.server";

export const getAdminSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { adminIdentity } = await import("@/lib/admin.server");
    const identity = await adminIdentity(supabaseAdmin, context.userId);
    const { count } = await supabaseAdmin
      .from("admin_users")
      .select("id", { count: "exact", head: true });
    return { identity, bootstrapAvailable: (count ?? 0) === 0 };
  });

/** One-time bootstrap: the first account may claim SUPER_ADMIN, never after. */
export const claimSuperAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { auditAdmin } = await import("@/lib/admin.server");
    const { error } = await supabaseAdmin.rpc("admin_bootstrap_super_admin", {
      _user_id: context.userId,
    });
    if (error) throw new Error(error.message);
    await auditAdmin(supabaseAdmin, {
      actorId: context.userId,
      actorRole: "SUPER_ADMIN",
      action: "admin.bootstrap",
      resourceType: "admin_users",
    });
    return { ok: true };
  });

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requirePermission, num } = await import("@/lib/admin.server");
    await requirePermission(supabaseAdmin, context.userId, "analytics.view");

    const since = new Date(Date.now() - 86_400_000).toISOString();
    const [users, rounds, results, withdrawals, risk, tickets, kyc, drift] = await Promise.all([
      supabaseAdmin.from("users").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("game_rounds")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since),
      supabaseAdmin.from("game_results").select("total_wagered, total_payout, players").gte("created_at", since),
      supabaseAdmin
        .from("withdrawals")
        .select("id, amount", { count: "exact" })
        .in("status", ["REQUESTED", "RISK_REVIEW", "APPROVED"]),
      supabaseAdmin
        .from("risk_events")
        .select("id", { count: "exact", head: true })
        .in("status", ["OPEN", "IN_REVIEW", "ESCALATED"]),
      supabaseAdmin
        .from("support_tickets")
        .select("id", { count: "exact", head: true })
        .in("status", ["OPEN", "PENDING_USER", "ESCALATED"]),
      supabaseAdmin
        .from("kyc_cases")
        .select("id", { count: "exact", head: true })
        .in("status", ["PENDING", "REQUIRES_INFORMATION"]),
      supabaseAdmin.rpc("wallet_ledger_drift"),
    ]);

    const wagered = (results.data ?? []).reduce((s, r) => s + num(r.total_wagered), 0);
    const payout = (results.data ?? []).reduce((s, r) => s + num(r.total_payout), 0);

    return {
      users: users.count ?? 0,
      rounds24h: rounds.count ?? 0,
      wagered24h: wagered,
      payout24h: payout,
      ggr24h: wagered - payout,
      pendingWithdrawals: withdrawals.count ?? 0,
      pendingWithdrawalValue: (withdrawals.data ?? []).reduce((s, w) => s + num(w.amount), 0),
      openRiskEvents: risk.count ?? 0,
      openTickets: tickets.count ?? 0,
      pendingKyc: kyc.count ?? 0,
      // wallet_ledger_drift() returns every wallet; only non-zero rows are drift.
      driftedWallets: (drift.data ?? []).filter((row) => num(row.drift) !== 0).length,
    };
  });

export const listPendingWithdrawals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requirePermission } = await import("@/lib/admin.server");
    await requirePermission(supabaseAdmin, context.userId, "withdrawal.review");
    const { data, error } = await supabaseAdmin
      .from("withdrawals")
      .select(
        "id, user_id, currency, network, amount, fee_amount, destination_address, status, risk_status, approvals_required, approvals_count, requested_at",
      )
      .in("status", ["REQUESTED", "RISK_REVIEW", "APPROVED"])
      .order("requested_at", { ascending: true })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const decideWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const base = parseDecision(data);
    const decision = (data as { decision?: unknown })?.decision;
    if (decision !== "APPROVE" && decision !== "REJECT") throw new Error("Invalid decision.");
    return { ...base, decision: decision as "APPROVE" | "REJECT" };
  })
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requirePermission, auditAdmin, num } = await import("@/lib/admin.server");
    const { notify } = await import("@/lib/support.server");
    const identity = await requirePermission(
      supabaseAdmin,
      context.userId,
      data.decision === "APPROVE" ? "withdrawal.approve" : "withdrawal.reject",
    );

    const { data: withdrawal, error } = await supabaseAdmin
      .from("withdrawals")
      .select(
        "id, user_id, wallet_id, amount, currency, network, status, approvals_required, approvals_count, destination_address",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!withdrawal) throw new Error("Withdrawal not found.");
    if (!["REQUESTED", "RISK_REVIEW", "APPROVED"].includes(withdrawal.status)) {
      throw new Error("This withdrawal is no longer actionable.");
    }
    if (withdrawal.user_id === context.userId) {
      throw new Error("You cannot decide your own withdrawal.");
    }

    const { data: priorApprovals } = await supabaseAdmin
      .from("withdrawal_approvals")
      .select("approver_id, decision")
      .eq("withdrawal_id", withdrawal.id);
    if ((priorApprovals ?? []).some((a) => a.approver_id === context.userId)) {
      throw new Error("You have already recorded a decision on this withdrawal.");
    }

    const { error: approvalError } = await supabaseAdmin.from("withdrawal_approvals").insert({
      withdrawal_id: withdrawal.id,
      approver_id: context.userId,
      decision: data.decision,
      note: data.note,
    });
    if (approvalError) throw new Error(approvalError.message);

    const now = new Date().toISOString();

    if (data.decision === "REJECT") {
      const { error: unlockError } = await supabaseAdmin.rpc("move_wallet_lock", {
        _wallet_id: withdrawal.wallet_id,
        _amount: num(withdrawal.amount),
        _lock: false,
        _entry_type: "WITHDRAWAL_UNLOCK",
        _reference_type: "withdrawals",
        _reference_id: withdrawal.id,
      });
      if (unlockError) throw new Error(unlockError.message);
      await supabaseAdmin
        .from("withdrawals")
        .update({ status: "REJECTED", rejected_at: now, failure_reason: data.note })
        .eq("id", withdrawal.id);
      await notify(
        supabaseAdmin,
        withdrawal.user_id,
        "withdrawal.rejected",
        "Withdrawal rejected",
        `Your ${withdrawal.amount} ${withdrawal.currency} withdrawal was rejected and the funds were returned to your balance.`,
      );
    } else {
      const approvals = (withdrawal.approvals_count ?? 0) + 1;
      const settled = approvals >= (withdrawal.approvals_required ?? 1);
      await supabaseAdmin
        .from("withdrawals")
        .update({
          approvals_count: approvals,
          status: settled ? "PROCESSING" : "APPROVED",
          approved_at: now,
        })
        .eq("id", withdrawal.id);

      if (settled) {
        // Release the reservation, then debit the balance out to the payment rail.
        const { error: unlockError } = await supabaseAdmin.rpc("move_wallet_lock", {
          _wallet_id: withdrawal.wallet_id,
          _amount: num(withdrawal.amount),
          _lock: false,
          _entry_type: "WITHDRAWAL_UNLOCK",
          _reference_type: "withdrawals",
          _reference_id: withdrawal.id,
        });
        if (unlockError) throw new Error(unlockError.message);

        const { error: debitError } = await supabaseAdmin.rpc("post_wallet_transaction", {
          _wallet_id: withdrawal.wallet_id,
          _direction: "DEBIT",
          _amount: num(withdrawal.amount),
          _entry_type: "WITHDRAWAL",
          _counter_account_type: "EXTERNAL_PAYMENT",
          _reference_type: "withdrawals",
          _reference_id: withdrawal.id,
          _metadata: { network: withdrawal.network } as never,
        });
        if (debitError) throw new Error(debitError.message);

        const { MockCryptoProvider } = await import("@/lib/payments.server");
        const broadcast = await MockCryptoProvider.submitWithdrawal({
          withdrawalId: withdrawal.id,
          currency: withdrawal.currency,
          network: withdrawal.network,
          amount: num(withdrawal.amount),
          destinationAddress: withdrawal.destination_address,
        });

        await supabaseAdmin
          .from("withdrawals")
          .update({
            status: "CONFIRMED",
            provider: MockCryptoProvider.id,
            provider_transaction_id: broadcast.providerTransactionId,
            processed_at: now,
            completed_at: now,
          })
          .eq("id", withdrawal.id);

        await notify(
          supabaseAdmin,
          withdrawal.user_id,
          "withdrawal.completed",
          "Withdrawal sent",
          `${withdrawal.amount} ${withdrawal.currency} was sent to ${withdrawal.destination_address}.`,
        );
      }
    }

    await auditAdmin(supabaseAdmin, {
      actorId: context.userId,
      actorRole: identity.roleKey,
      action: `withdrawal.${data.decision.toLowerCase()}`,
      resourceType: "withdrawals",
      resourceId: withdrawal.id,
      metadata: { note: data.note },
    });

    return { ok: true };
  });

export const listKycQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requirePermission } = await import("@/lib/admin.server");
    await requirePermission(supabaseAdmin, context.userId, "kyc.view");
    const { data, error } = await supabaseAdmin
      .from("kyc_cases")
      .select("id, user_id, status, risk_level, submitted_at, rejection_reason")
      .in("status", ["PENDING", "REQUIRES_INFORMATION"])
      .order("submitted_at", { ascending: true })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const decideKyc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const base = parseDecision(data);
    const decision = (data as { decision?: unknown })?.decision;
    if (decision !== "APPROVED" && decision !== "REJECTED") throw new Error("Invalid decision.");
    return { ...base, decision: decision as "APPROVED" | "REJECTED" };
  })
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requirePermission, auditAdmin } = await import("@/lib/admin.server");
    const { notify } = await import("@/lib/support.server");
    const identity = await requirePermission(supabaseAdmin, context.userId, "kyc.decide");

    const { data: kycCase, error } = await supabaseAdmin
      .from("kyc_cases")
      .select("id, user_id, status")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!kycCase) throw new Error("Case not found.");

    const { error: updateError } = await supabaseAdmin
      .from("kyc_cases")
      .update({
        status: data.decision,
        reviewer_id: context.userId,
        reviewed_at: new Date().toISOString(),
        rejection_reason: data.decision === "REJECTED" ? (data.note ?? "Not eligible") : null,
      })
      .eq("id", kycCase.id);
    if (updateError) throw new Error(updateError.message);

    await notify(
      supabaseAdmin,
      kycCase.user_id,
      "kyc.decided",
      data.decision === "APPROVED" ? "Verification approved" : "Verification rejected",
      data.decision === "APPROVED"
        ? "Your identity check passed. Real-money features are now available."
        : (data.note ?? "Your identity check could not be completed."),
    );

    await auditAdmin(supabaseAdmin, {
      actorId: context.userId,
      actorRole: identity.roleKey,
      action: "kyc.decided",
      resourceType: "kyc_cases",
      resourceId: kycCase.id,
      metadata: { decision: data.decision, note: data.note },
    });

    return { ok: true };
  });

export const listRiskEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requirePermission } = await import("@/lib/admin.server");
    await requirePermission(supabaseAdmin, context.userId, "risk.view");
    const { data, error } = await supabaseAdmin
      .from("risk_events")
      .select("id, user_id, event_type, risk_score, severity, status, source, description, created_at")
      .in("status", ["OPEN", "IN_REVIEW", "ESCALATED"])
      .order("risk_score", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const resolveRiskEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const base = parseDecision(data);
    const status = (data as { status?: unknown })?.status;
    if (status !== "RESOLVED" && status !== "DISMISSED" && status !== "ESCALATED") {
      throw new Error("Invalid status.");
    }
    return { ...base, status: status as "RESOLVED" | "DISMISSED" | "ESCALATED" };
  })
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requirePermission, auditAdmin } = await import("@/lib/admin.server");
    const identity = await requirePermission(supabaseAdmin, context.userId, "risk.resolve");

    const closing = data.status !== "ESCALATED";
    const { error } = await supabaseAdmin
      .from("risk_events")
      .update({
        status: data.status,
        resolved_at: closing ? new Date().toISOString() : null,
        resolved_by: closing ? context.userId : null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await auditAdmin(supabaseAdmin, {
      actorId: context.userId,
      actorRole: identity.roleKey,
      action: "risk.updated",
      resourceType: "risk_events",
      resourceId: data.id,
      metadata: { status: data.status, note: data.note },
    });
    return { ok: true };
  });

export const runRiskScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requirePermission, auditAdmin } = await import("@/lib/admin.server");
    const { buildRiskProfile, recordRiskProfile } = await import("@/lib/risk.server");
    const identity = await requirePermission(supabaseAdmin, context.userId, "risk.view");

    const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const { data: recent } = await supabaseAdmin
      .from("users")
      .select("id")
      .gte("updated_at", since)
      .limit(200);

    let flagged = 0;
    for (const row of recent ?? []) {
      const profile = await buildRiskProfile(supabaseAdmin, row.id);
      const result = await recordRiskProfile(supabaseAdmin, profile, "SCAN");
      if (result.created) flagged += 1;
    }

    await auditAdmin(supabaseAdmin, {
      actorId: context.userId,
      actorRole: identity.roleKey,
      action: "risk.scan",
      resourceType: "risk_events",
      metadata: { scanned: (recent ?? []).length, flagged },
    });

    return { scanned: (recent ?? []).length, flagged };
  });

export const listAdminTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requirePermission } = await import("@/lib/admin.server");
    await requirePermission(supabaseAdmin, context.userId, "support.view");
    const { data: tickets, error } = await supabaseAdmin
      .from("support_tickets")
      .select("id, user_id, reference, category, subject, status, priority, created_at")
      .in("status", ["OPEN", "PENDING_USER", "ESCALATED"])
      .order("created_at", { ascending: true })
      .limit(50);
    if (error) throw new Error(error.message);

    const ids = (tickets ?? []).map((t) => t.id);
    const messages = ids.length
      ? (
          await supabaseAdmin
            .from("support_messages")
            .select("id, ticket_id, author_type, body, created_at")
            .in("ticket_id", ids)
            .order("created_at", { ascending: true })
        ).data ?? []
      : [];
    const userIds = [...new Set((tickets ?? []).map((t) => t.user_id))];
    const accounts = userIds.length
      ? (
          await supabaseAdmin
            .from("users")
            .select("id, account_number, email")
            .in("id", userIds)
        ).data ?? []
      : [];
    return (tickets ?? []).map((t) => {
      const acct = accounts.find((a) => a.id === t.user_id);
      return {
        ...t,
        accountNumber: acct?.account_number ?? null,
        userEmail: acct?.email ?? null,
        messages: messages.filter((m) => m.ticket_id === t.id),
      };
    });
  });

export const answerTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const d = (data ?? {}) as Record<string, unknown>;
    const ticketId = typeof d["ticketId"] === "string" ? d["ticketId"] : "";
    const body = typeof d["body"] === "string" ? d["body"].trim().slice(0, 4000) : "";
    const resolve = d["resolve"] === true;
    if (!ticketId) throw new Error("Missing ticket.");
    if (body.length < 2) throw new Error("Write a reply first.");
    return { ticketId, body, resolve };
  })
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requirePermission, auditAdmin } = await import("@/lib/admin.server");
    const { notify } = await import("@/lib/support.server");
    const identity = await requirePermission(supabaseAdmin, context.userId, "support.reply");

    const { data: ticket, error } = await supabaseAdmin
      .from("support_tickets")
      .select("id, user_id, reference")
      .eq("id", data.ticketId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!ticket) throw new Error("Ticket not found.");

    const { error: messageError } = await supabaseAdmin.from("support_messages").insert({
      ticket_id: ticket.id,
      author_id: context.userId,
      author_type: "AGENT",
      body: data.body,
      internal_note: false,
    });
    if (messageError) throw new Error(messageError.message);

    await supabaseAdmin
      .from("support_tickets")
      .update({
        status: data.resolve ? "RESOLVED" : "PENDING_USER",
        assigned_to: context.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticket.id);

    await notify(
      supabaseAdmin,
      ticket.user_id,
      "support.reply",
      "Support replied",
      `There is a new reply on ticket ${ticket.reference}.`,
    );

    await auditAdmin(supabaseAdmin, {
      actorId: context.userId,
      actorRole: identity.roleKey,
      action: "support.replied",
      resourceType: "support_tickets",
      resourceId: ticket.id,
      metadata: { resolved: data.resolve },
    });

    return { ok: true };
  });

export const listAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requirePermission } = await import("@/lib/admin.server");
    await requirePermission(supabaseAdmin, context.userId, "audit.view");
    const { data, error } = await supabaseAdmin
      .from("audit_logs")
      .select("id, actor_id, actor_role, action, resource_type, resource_id, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
/** Phase 16 — reporting: daily GGR series, payments volume and top players. */
export const getAdminAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requirePermission, num } = await import("@/lib/admin.server");
    const { buildSeries, topPlayers } = await import("@/lib/analytics.server");
    await requirePermission(supabaseAdmin, context.userId, "analytics.view");

    const days = 14;
    const since = new Date(Date.now() - days * 86_400_000).toISOString();

    const [results, bets, deposits, withdrawals, newUsers] = await Promise.all([
      supabaseAdmin
        .from("game_results")
        .select("created_at, total_wagered, total_payout")
        .gte("created_at", since),
      supabaseAdmin
        .from("bets")
        .select("user_id, amount, payout_amount")
        .gte("placed_at", since)
        .limit(1000),
      supabaseAdmin
        .from("deposits")
        .select("confirmed_amount, currency, status")
        .eq("status", "CONFIRMED")
        .gte("created_at", since),
      supabaseAdmin
        .from("withdrawals")
        .select("amount, fee_amount, status")
        .in("status", ["CONFIRMED", "PROCESSING", "BROADCAST"])
        .gte("requested_at", since),
      supabaseAdmin
        .from("users")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since),
    ]);

    const series = buildSeries(days, results.data ?? []);
    const wagered = series.reduce((s, b) => s + b.wagered, 0);
    const payout = series.reduce((s, b) => s + b.payout, 0);

    return {
      days,
      series,
      totals: {
        wagered,
        payout,
        ggr: wagered - payout,
        holdPercent: wagered > 0 ? ((wagered - payout) / wagered) * 100 : 0,
        rounds: series.reduce((s, b) => s + b.rounds, 0),
        newUsers: newUsers.count ?? 0,
        depositVolume: (deposits.data ?? []).reduce((s, d) => s + num(d.confirmed_amount), 0),
        withdrawalVolume: (withdrawals.data ?? []).reduce((s, w) => s + num(w.amount), 0),
        withdrawalFees: (withdrawals.data ?? []).reduce((s, w) => s + num(w.fee_amount), 0),
      },
      topPlayers: topPlayers(bets.data ?? []),
    };
  });
