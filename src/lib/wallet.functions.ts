import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertDemoTopupAllowed, auditWallet } from "@/lib/wallet.server";

export const getWallets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [wallets, entries] = await Promise.all([
      supabase
        .from("wallets")
        .select("id, currency, kind, available_amount, locked_amount, status, created_at")
        .eq("user_id", userId)
        .order("kind", { ascending: true })
        .order("currency", { ascending: true }),
      supabase
        .from("ledger_entries")
        .select(
          "id, transaction_id, entry_type, direction, amount, currency, reference_type, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    if (wallets.error) throw new Error(wallets.error.message);
    if (entries.error) throw new Error(entries.error.message);

    return { wallets: wallets.data ?? [], entries: entries.data ?? [] };
  });

// Demo credits only. Real-money funding arrives with the payments phase.
export const topUpDemoWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("status")
      .eq("id", userId)
      .maybeSingle();
    if (userError) throw new Error(userError.message);
    if (!user || user.status !== "ACTIVE") {
      throw new Error("Your account is not active.");
    }

    const { data: rg } = await supabaseAdmin
      .from("responsible_gambling_limits")
      .select("cooling_off_until, self_exclusion_until")
      .eq("user_id", userId)
      .maybeSingle();
    const now = Date.now();
    const blocked = [rg?.cooling_off_until, rg?.self_exclusion_until].some(
      (value) => value && new Date(value).getTime() > now,
    );
    if (blocked) {
      throw new Error("Funding is blocked while a cooling-off or self-exclusion period is active.");
    }

    const { walletId, amount } = await assertDemoTopupAllowed(supabaseAdmin, userId);

    const { data: transactionId, error } = await supabaseAdmin.rpc("post_wallet_transaction", {
      _wallet_id: walletId,
      _direction: "CREDIT",
      _amount: amount,
      _entry_type: "DEMO_TOPUP",
      _counter_account_type: "HOUSE",
      _reference_type: "demo_topup",
    });
    if (error) throw new Error(error.message);

    await auditWallet(supabaseAdmin, {
      actorId: userId,
      action: "wallet.demo_topup",
      resourceId: walletId,
      metadata: { amount, transaction_id: transactionId },
    });

    return { amount, transactionId };
  });
