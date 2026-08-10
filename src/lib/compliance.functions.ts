import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseKycInput, parseKycDocumentInput } from "@/lib/compliance.server";

export const uploadKycDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseKycDocumentInput(data))
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { audit } = await import("@/lib/user-management.server");

    const bytes = Buffer.from(data.contentBase64, "base64");
    if (bytes.byteLength === 0) throw new Error("The file is empty.");
    if (bytes.byteLength > 10 * 1024 * 1024) throw new Error("Files must be 10 MB or smaller.");

    const ext = (data.fileName.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${userId}/${Date.now()}-${data.docType.toLowerCase()}.${ext || "bin"}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("kyc-documents")
      .upload(path, bytes, { contentType: data.mimeType, upsert: false });
    if (uploadError) throw new Error(uploadError.message);

    const { data: kycCase } = await supabaseAdmin
      .from("kyc_cases")
      .select("id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error } = await supabaseAdmin.from("kyc_documents").insert({
      user_id: userId,
      kyc_case_id: kycCase?.id ?? null,
      doc_type: data.docType,
      storage_path: path,
      file_name: data.fileName,
      mime_type: data.mimeType,
      size_bytes: bytes.byteLength,
      status: "PENDING",
    });
    if (error) throw new Error(error.message);

    await audit(supabaseAdmin, {
      actorId: userId,
      action: "kyc.document_uploaded",
      resourceType: "kyc_documents",
      metadata: { doc_type: data.docType },
    });

    return { ok: true as const, docType: data.docType };
  });

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