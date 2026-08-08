import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { AccountNav } from "@/components/account/AccountNav";
import { Button } from "@/components/ui/button";
import { getComplianceStatus, submitKyc } from "@/lib/compliance.functions";

const title = "Verification & Compliance — Rocket Flight";
const description =
  "Check your jurisdiction eligibility, age verification and KYC status. Real-money features unlock only once every compliance gate passes.";

export const Route = createFileRoute("/_authenticated/compliance")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CompliancePage,
});

const sources = [
  { value: "EMPLOYMENT", label: "Employment income" },
  { value: "BUSINESS", label: "Business income" },
  { value: "INVESTMENTS", label: "Investments" },
  { value: "SAVINGS", label: "Savings" },
  { value: "OTHER", label: "Other" },
];

function CompliancePage() {
  const queryClient = useQueryClient();
  const fetchStatus = useServerFn(getComplianceStatus);
  const submit = useServerFn(submitKyc);

  const [sourceOfFunds, setSourceOfFunds] = useState("EMPLOYMENT");
  const [declaredPep, setDeclaredPep] = useState(false);

  const status = useQuery({
    queryKey: ["compliance", "status"],
    queryFn: async () => fetchStatus({ data: undefined }),
  });

  const mutation = useMutation({
    mutationFn: async () => submit({ data: { sourceOfFunds, declaredPep } }),
    onSuccess: (result) => {
      toast.success(`Verification ${result.status.toLowerCase().replace(/_/g, " ")}.`);
      void queryClient.invalidateQueries({ queryKey: ["compliance"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const data = status.data;
  const kycStatus = data?.kyc?.status ?? "NOT_STARTED";

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Verification &amp; compliance</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Real-money deposits and withdrawals stay locked until every gate below is green. Demo
        play is unaffected.
      </p>
      <AccountNav />

      <section className="mt-8 rounded-2xl border border-border bg-card/60 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Real-money eligibility
            </p>
            <p className="mt-1 text-lg font-semibold">
              {data?.realMoneyEligible ? "Eligible" : "Not eligible yet"}
            </p>
          </div>
          <span
            className={`rounded-full border px-3 py-1 text-xs ${
              kycStatus === "APPROVED"
                ? "border-success/40 text-success"
                : kycStatus === "REJECTED"
                  ? "border-destructive/40 text-destructive"
                  : "border-warning/40 text-warning"
            }`}
          >
            KYC {kycStatus.toLowerCase().replace(/_/g, " ")}
          </span>
        </div>

        <ul className="mt-6 space-y-3">
          {(data?.gates ?? []).map((gate) => (
            <li key={gate.key} className="flex gap-3 rounded-lg border border-border p-3 text-sm">
              <span
                className={`mt-1.5 inline-block size-2 shrink-0 rounded-full ${
                  gate.passed ? "bg-success" : "bg-warning"
                }`}
                aria-hidden
              />
              <span>
                <span className="font-medium">{gate.label}</span>
                <span className="block text-xs text-muted-foreground">{gate.detail}</span>
              </span>
            </li>
          ))}
        </ul>

        {data?.kyc?.rejection_reason ? (
          <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {data.kyc.rejection_reason}
          </p>
        ) : null}
      </section>

      <section className="mt-6 rounded-xl border border-border p-5">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Submit identity verification
        </p>
        <label className="mt-4 block text-sm" htmlFor="sof">
          Source of funds
        </label>
        <select
          id="sof"
          value={sourceOfFunds}
          onChange={(event) => setSourceOfFunds(event.target.value)}
          className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          {sources.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={declaredPep}
            onChange={(event) => setDeclaredPep(event.target.checked)}
          />
          I am a politically exposed person (PEP) or a close associate of one
        </label>

        <Button
          className="mt-5"
          disabled={mutation.isPending || kycStatus === "APPROVED"}
          onClick={() => mutation.mutate()}
        >
          {kycStatus === "APPROVED" ? "Verified" : "Submit for verification"}
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">
          Demo mode uses an internal rules-based reviewer. A licensed KYC provider replaces this
          decision step before real-money launch; documents are never stored here.
        </p>
      </section>
    </main>
  );
}