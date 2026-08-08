import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseDepositInput, parseWithdrawalInput } from "@/lib/payments.server";

export const getPaymentsOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { listNetworks } = await import("@/lib/payments.server");
    const { complianceSnapshot } = await import("@/lib/compliance.server");
    const userId = context.userId;

    const [networks, compliance, wallets, deposits, withdrawals] = await Promise.all([
      listNetworks(supabaseAdmin),
      complianceSnapshot(supabaseAdmin, userId),
      supabaseAdmin
        .from("wallets")
        .select("id, currency, kind, available_amount, locked_amount, status")
        .eq("user_id", userId)
        .eq("kind", "REAL"),
      supabaseAdmin
        .from("deposits")
        .select(
          "id, currency, network, status, deposit_address, requested_amount, confirmed_amount, confirmations, required_confirmations, created_at",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabaseAdmin
        .from("withdrawals")
        .select(
          "id, currency, network, amount, fee_amount, destination_address, status, risk_status, approvals_required, approvals_count, failure_reason, requested_at",
        )
        .eq("user_id", userId)
        .order("requested_at", { ascending: false })
        .limit(20),
    ]);

    return {
      networks,
      realMoneyEligible: compliance.realMoneyEligible,
      gates: compliance.gates,
      wallets: wallets.data ?? [],
      deposits: deposits.data ?? [],
      withdrawals: withdrawals.data ?? [],
    };
  });

export const createDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseDepositInput(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { assertRealMoneyEligible } = await import("@/lib/compliance.server");
    const {
      MockCryptoProvider,
      PROVIDER_ID,
      assertNotRestricted,
      auditPayments,
      ensureRealWallet,
      requireNetwork,
    } = await import("@/lib/payments.server");
    const userId = context.userId;

    await assertRealMoneyEligible(supabaseAdmin, userId);
    await assertNotRestricted(supabaseAdmin, userId);
    const network = await requireNetwork(supabaseAdmin, data.currency, data.network);
    const wallet = await ensureRealWallet(supabaseAdmin, userId, data.currency);
    if (wallet.status !== "ACTIVE") throw new Error("That wallet is not active.");

    const address = await MockCryptoProvider.createDepositAddress({
      userId,
      currency: data.currency,
      network: data.network,
    });

    const { data: deposit, error } = await supabaseAdmin
      .from("deposits")
      .insert({
        user_id: userId,
        wallet_id: wallet.id,
        provider: PROVIDER_ID,
        provider_transaction_id: address.providerTransactionId,
        currency: data.currency,
        network: data.network,
        deposit_address: address.address,
        status: "PENDING",
        required_confirmations: network.requiredConfirmations,
        metadata: { min_deposit: network.minDeposit } as never,
      })
      .select("id, deposit_address, required_confirmations")
      .single();
    if (error) throw new Error(error.message);

    await auditPayments(supabaseAdmin, {
      actorId: userId,
      action: "deposit.address_issued",
      resourceType: "deposits",
      resourceId: deposit.id,
      metadata: { currency: data.currency, network: data.network },
    });

    return deposit;
  });

/**
 * Demo-only settlement: stands in for the chain watcher until a real provider
 * is connected. It runs the exact same credit path a webhook would.
 */
export const simulateDepositCredit = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const d = (data ?? {}) as { depositId?: unknown; amount?: unknown };
    const depositId = typeof d.depositId === "string" ? d.depositId : "";
    const amount = Number(d.amount);
    if (!depositId) throw new Error("Missing deposit.");
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a valid amount.");
    return { depositId, amount };
  })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { PROVIDER_ID, creditDeposit, requireNetwork, auditPayments } = await import(
      "@/lib/payments.server"
    );
    const userId = context.userId;

    const { data: deposit, error } = await supabaseAdmin
      .from("deposits")
      .select("id, user_id, provider, currency, network, status, required_confirmations")
      .eq("id", data.depositId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!deposit || deposit.user_id !== userId) throw new Error("Deposit not found.");
    if (deposit.provider !== PROVIDER_ID) {
      throw new Error("Only simulated deposits can be settled from the app.");
    }
    if (deposit.status === "CONFIRMED") return { credited: false, alreadyCredited: true };

    const network = await requireNetwork(supabaseAdmin, deposit.currency, deposit.network);
    if (data.amount < network.minDeposit) {
      throw new Error(`Minimum deposit is ${network.minDeposit} ${deposit.currency}.`);
    }

    const result = await creditDeposit(
      supabaseAdmin,
      deposit.id,
      data.amount,
      deposit.required_confirmations,
    );

    await auditPayments(supabaseAdmin, {
      actorId: userId,
      action: "deposit.simulated_settlement",
      resourceType: "deposits",
      resourceId: deposit.id,
      metadata: { amount: data.amount },
    });

    return { credited: result.credited, alreadyCredited: false };
  });

export const requestWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseWithdrawalInput(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { assertRealMoneyEligible } = await import("@/lib/compliance.server");
    const {
      DUAL_APPROVAL_THRESHOLD,
      PROVIDER_ID,
      WITHDRAWAL_FEE_RATE,
      assertNotRestricted,
      auditPayments,
      ensureRealWallet,
      requireNetwork,
      toNumber,
    } = await import("@/lib/payments.server");
    const userId = context.userId;

    await assertRealMoneyEligible(supabaseAdmin, userId);
    await assertNotRestricted(supabaseAdmin, userId);
    const network = await requireNetwork(supabaseAdmin, data.currency, data.network);
    if (data.amount < network.minWithdrawal) {
      throw new Error(`Minimum withdrawal is ${network.minWithdrawal} ${data.currency}.`);
    }

    const wallet = await ensureRealWallet(supabaseAdmin, userId, data.currency);
    if (wallet.status !== "ACTIVE") throw new Error("That wallet is not active.");

    const { data: balance, error: balanceError } = await supabaseAdmin
      .from("wallets")
      .select("available_amount")
      .eq("id", wallet.id)
      .single();
    if (balanceError) throw new Error(balanceError.message);
    if (toNumber(balance.available_amount) < data.amount) {
      throw new Error("Insufficient available balance for that withdrawal.");
    }

    const fee = Number((data.amount * WITHDRAWAL_FEE_RATE).toFixed(network.decimals));
    const dualApproval = data.amount >= DUAL_APPROVAL_THRESHOLD;

    const { data: withdrawal, error } = await supabaseAdmin
      .from("withdrawals")
      .insert({
        user_id: userId,
        wallet_id: wallet.id,
        currency: data.currency,
        network: data.network,
        amount: data.amount,
        fee_amount: fee,
        destination_address: data.destinationAddress,
        provider: PROVIDER_ID,
        status: dualApproval ? "RISK_REVIEW" : "REQUESTED",
        risk_status: dualApproval ? "REVIEW_REQUIRED" : "LOW",
        approvals_required: dualApproval ? 2 : 1,
        metadata: { fee_rate: WITHDRAWAL_FEE_RATE } as never,
      })
      .select("id, status, amount, fee_amount, approvals_required")
      .single();
    if (error) throw new Error(error.message);

    // Reserve the funds immediately so the balance cannot be spent twice.
    const { error: lockError } = await supabaseAdmin.rpc("move_wallet_lock", {
      _wallet_id: wallet.id,
      _amount: data.amount,
      _lock: true,
      _entry_type: "WITHDRAWAL_LOCK",
      _reference_type: "withdrawals",
      _reference_id: withdrawal.id,
    });
    if (lockError) {
      await supabaseAdmin
        .from("withdrawals")
        .update({ status: "FAILED", failure_reason: lockError.message })
        .eq("id", withdrawal.id);
      throw new Error(lockError.message);
    }

    if (dualApproval) {
      await supabaseAdmin.from("risk_events").insert({
        user_id: userId,
        event_type: "withdrawal.large",
        risk_score: 65,
        severity: "REVIEW_REQUIRED",
        status: "OPEN",
        source: "PAYMENTS",
        description: "Withdrawal above the dual-approval threshold.",
        metadata: { withdrawal_id: withdrawal.id, amount: data.amount } as never,
      });
    }

    await auditPayments(supabaseAdmin, {
      actorId: userId,
      action: "withdrawal.requested",
      resourceType: "withdrawals",
      resourceId: withdrawal.id,
      metadata: { amount: data.amount, currency: data.currency, network: data.network },
    });

    return withdrawal;
  });

export const cancelWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const id = (data as { id?: unknown })?.id;
    if (typeof id !== "string" || !id) throw new Error("Missing withdrawal.");
    return { id };
  })
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { auditPayments } = await import("@/lib/payments.server");
    const userId = context.userId;

    const { data: withdrawal, error } = await supabaseAdmin
      .from("withdrawals")
      .select("id, user_id, wallet_id, amount, status")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!withdrawal || withdrawal.user_id !== userId) throw new Error("Withdrawal not found.");
    if (!["REQUESTED", "RISK_REVIEW"].includes(withdrawal.status)) {
      throw new Error("This withdrawal can no longer be cancelled.");
    }

    const { error: cancelError } = await supabaseAdmin
      .from("withdrawals")
      .update({ status: "CANCELLED", rejected_at: new Date().toISOString() })
      .eq("id", withdrawal.id)
      .in("status", ["REQUESTED", "RISK_REVIEW"]);
    if (cancelError) throw new Error(cancelError.message);

    const { error: unlockError } = await supabaseAdmin.rpc("move_wallet_lock", {
      _wallet_id: withdrawal.wallet_id,
      _amount: Number(withdrawal.amount),
      _lock: false,
      _entry_type: "WITHDRAWAL_UNLOCK",
      _reference_type: "withdrawals",
      _reference_id: withdrawal.id,
    });
    if (unlockError) throw new Error(unlockError.message);

    await auditPayments(supabaseAdmin, {
      actorId: userId,
      action: "withdrawal.cancelled",
      resourceType: "withdrawals",
      resourceId: withdrawal.id,
    });

    return { cancelled: true };
  });