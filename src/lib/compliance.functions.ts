import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseKycInput } from "@/lib/compliance.server";

export const getComplianceStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { complianceSnapshot } = await import("@/lib/compliance.server");
    return complianceSnapshot(supabaseAdmin, context.userId);
  });

export const submitKyc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseKycInput(data))
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { complianceSnapshot, decideCase, KYC_PROVIDER } = await import(
      "@/lib/compliance.server"
    );
    const { audit } = await import("@/lib/user-management.server");

    const snapshot = await complianceSnapshot(supabaseAdmin, userId);
    if (!snapshot.countryCode || !snapshot.dateOfBirth) {
      throw new Error("Add your country and date of birth on the profile page first.");
    }
    if (snapshot.kyc?.status === "APPROVED") {
      return { status: snapshot.kyc.status, reason: null as string | null };
    }

    const decision = decideCase(snapshot, { declaredPep: data.declaredPep });
    const now = new Date().toISOString();
    const row = {
      user_id: userId,
      provider: KYC_PROVIDER,
      status: decision.status,
      risk_level: decision.risk,
      submitted_at: now,
      reviewed_at: decision.status === "REQUIRES_INFORMATION" ? null : now,
      rejection_reason: decision.reason,
    };

    if (snapshot.kyc) {
      const { error } = await supabaseAdmin
        .from("kyc_cases")
        .update(row)
        .eq("id", snapshot.kyc.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("kyc_cases").insert(row);
      if (error) throw new Error(error.message);
    }

    if (decision.risk !== "LOW") {
      await supabaseAdmin.from("risk_events").insert({
        user_id: userId,
        event_type: "kyc.review",
        risk_score: decision.status === "REJECTED" ? 90 : 55,
        severity: decision.risk,
        status: "OPEN",
        source: "COMPLIANCE",
        description: decision.reason,
        metadata: { source_of_funds: data.sourceOfFunds, declared_pep: data.declaredPep },
      });
    }

    await audit(supabaseAdmin, {
      actorId: userId,
      action: "kyc.submitted",
      resourceType: "kyc_cases",
      metadata: {
        decision: decision.status,
        source_of_funds: data.sourceOfFunds,
        declared_pep: data.declaredPep,
      },
    });

    return { status: decision.status, reason: decision.reason };
  });