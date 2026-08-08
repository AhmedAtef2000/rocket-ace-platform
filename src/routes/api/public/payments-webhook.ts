import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Provider callback for on-chain deposit confirmations. Public by necessity —
 * every request must carry a valid HMAC signature over the raw body.
 */
export const Route = createFileRoute("/api/public/payments-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["PAYMENTS_WEBHOOK_SECRET"];
        if (!secret) return new Response("Not configured", { status: 503 });

        const signature = request.headers.get("x-payments-signature") ?? "";
        const body = await request.text();
        const expected = createHmac("sha256", secret).update(body).digest("hex");
        const provided = Buffer.from(signature, "utf8");
        const digest = Buffer.from(expected, "utf8");
        if (provided.length !== digest.length || !timingSafeEqual(provided, digest)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: { event?: string; deposit_id?: string; amount?: number; confirmations?: number };
        try {
          payload = JSON.parse(body);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        if (payload.event !== "deposit.updated") {
          return new Response("Ignored", { status: 202 });
        }
        const amount = Number(payload.amount);
        const confirmations = Number(payload.confirmations);
        if (
          typeof payload.deposit_id !== "string" ||
          !Number.isFinite(amount) ||
          amount <= 0 ||
          !Number.isFinite(confirmations) ||
          confirmations < 0
        ) {
          return new Response("Invalid payload", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { creditDeposit, auditPayments } = await import("@/lib/payments.server");

        try {
          const result = await creditDeposit(
            supabaseAdmin,
            payload.deposit_id,
            amount,
            confirmations,
          );
          await auditPayments(supabaseAdmin, {
            actorId: null,
            action: "deposit.webhook",
            resourceType: "deposits",
            resourceId: payload.deposit_id,
            metadata: { amount, confirmations, credited: result.credited },
          });
          return Response.json({ ok: true, credited: result.credited });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unhandled error";
          console.error("payments webhook failed", message);
          return Response.json({ ok: false, error: message }, { status: 400 });
        }
      },
    },
  },
});