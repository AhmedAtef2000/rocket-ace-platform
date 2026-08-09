import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { AccountNav } from "@/components/account/AccountNav";
import { Button } from "@/components/ui/button";
import {
  getComplianceStatus,
  submitKyc,
  uploadKycDocument,
} from "@/lib/compliance.functions";
import { useI18n } from "@/lib/i18n";

const title = "Verification & Compliance — AstroBet";
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
  { value: "EMPLOYMENT", key: "comp.source.employment" },
  { value: "BUSINESS", key: "comp.source.business" },
  { value: "INVESTMENTS", key: "comp.source.investments" },
  { value: "SAVINGS", key: "comp.source.savings" },
  { value: "OTHER", key: "comp.source.other" },
] as const;

const docTypes = [
  { value: "ID_FRONT", key: "comp.doc.idFront" },
  { value: "ID_BACK", key: "comp.doc.idBack" },
  { value: "SELFIE", key: "comp.doc.selfie" },
  { value: "PROOF_OF_ADDRESS", key: "comp.doc.proofOfAddress" },
] as const;

function readAsBase64(file: File, t: (key: string) => string) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(t("comp.error.fileRead")));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.readAsDataURL(file);
  });
}

function CompliancePage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const fetchStatus = useServerFn(getComplianceStatus);
  const submit = useServerFn(submitKyc);
  const upload = useServerFn(uploadKycDocument);

  const [sourceOfFunds, setSourceOfFunds] = useState("EMPLOYMENT");
  const [declaredPep, setDeclaredPep] = useState(false);
  const [docType, setDocType] = useState("ID_FRONT");
  const fileInput = useRef<HTMLInputElement>(null);

  const status = useQuery({
    queryKey: ["compliance", "status"],
    queryFn: async () => fetchStatus({ data: undefined }),
  });

  const mutation = useMutation({
    mutationFn: async () => submit({ data: { sourceOfFunds, declaredPep } }),
    onSuccess: (result) => {
      toast.success(`Verification ${t(`comp.status.${result.status}`)}.`);
      void queryClient.invalidateQueries({ queryKey: ["compliance"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const data = status.data;
  const kycStatus = data?.kyc?.status ?? "NOT_STARTED";
  const verified = kycStatus === "APPROVED";
  const visibleGates = (data?.gates ?? []).filter((gate) => !gate.internal);
  const documents = data?.documents ?? [];

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > 5 * 1024 * 1024) throw new Error(t("comp.error.fileSize"));
      const contentBase64 = await readAsBase64(file, t);
      return upload({
        data: { docType, fileName: file.name, mimeType: file.type, contentBase64 },
      });
    },
    onSuccess: () => {
      toast.success(t("comp.toast.uploaded"));
      if (fileInput.current) fileInput.current.value = "";
      void queryClient.invalidateQueries({ queryKey: ["compliance"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-8">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{t("comp.heading")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("comp.subtitle")}
      </p>
      <AccountNav />

      <section className="mt-8 rounded-2xl border border-border bg-card/60 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              {t("comp.eligibility.title")}
            </p>
            <p className="mt-1 text-lg font-semibold">
              {data?.realMoneyEligible ? t("comp.eligibility.yes") : t("comp.eligibility.no")}
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
            {t("comp.kyc.prefix")} {t(`comp.status.${kycStatus}`)}
          </span>
        </div>

        {!verified ? (
          <div className="mt-4 rounded-xl border border-warning/40 bg-warning/5 p-3 text-sm">
            <p className="font-medium text-foreground">{t("comp.locked.title")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("comp.locked.body")}
            </p>
          </div>
        ) : null}

        <ul className="mt-6 space-y-3">
          {visibleGates.map((gate) => (
            <li key={gate.key} className="flex gap-3 rounded-xl border border-border bg-card/50 p-3 text-sm">
              <span
                className={`mt-1.5 inline-block size-2 shrink-0 rounded-full ${
                  gate.passed ? "bg-success" : "bg-warning"
                }`}
                aria-hidden
              />
              <span className="flex-1">
                <span className="font-medium">{gate.label}</span>
                <span className="block text-xs text-muted-foreground">{gate.detail}</span>
              </span>
              {gate.key === "kyc" && !gate.passed ? (
                <a
                  href="#kyc-documents"
                  className="self-center rounded-md border border-primary/50 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                >
                  {t("comp.gate.uploadDocuments")}
                </a>
              ) : null}
              {gate.key === "identity" && !gate.passed ? (
                <Link
                  to="/profile"
                  className="self-center rounded-md border border-primary/50 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                >
                  {t("comp.gate.addDetails")}
                </Link>
              ) : null}
            </li>
          ))}
        </ul>

        {data?.kyc?.rejection_reason ? (
          <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {data.kyc.rejection_reason}
          </p>
        ) : null}
      </section>

      <section id="kyc-documents" className="mt-6 rounded-xl border border-border p-5">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          {t("comp.docs.title")}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <label className="block text-sm" htmlFor="doc-type">
              {t("comp.docs.type")}
            </label>
            <select
              id="doc-type"
              value={docType}
              onChange={(event) => setDocType(event.target.value)}
              className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              {docTypes.map((d) => (
                <option key={d.value} value={d.value}>
                  {t(d.key)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) uploadMutation.mutate(file);
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={uploadMutation.isPending}
              onClick={() => fileInput.current?.click()}
            >
              {uploadMutation.isPending ? t("comp.docs.uploading") : t("comp.docs.upload")}
            </Button>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {t("comp.docs.hint")}
        </p>

        {documents.length > 0 ? (
          <ul className="mt-4 space-y-2 text-sm">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-card/40 px-3 py-2"
              >
                <span>
                  <span className="font-medium">
                    {(() => {
                    const match = docTypes.find((d) => d.value === doc.doc_type);
                    return match ? t(match.key) : doc.doc_type;
                  })()}
                  </span>
                  <span className="block text-xs text-muted-foreground">{doc.file_name}</span>
                </span>
                <span
                  className={`rounded-full border px-2.5 py-1 text-xs ${
                    doc.status === "APPROVED"
                      ? "border-success/40 text-success"
                      : doc.status === "REJECTED"
                        ? "border-destructive/40 text-destructive"
                        : "border-warning/40 text-warning"
                  }`}
                >
                  {t(`comp.status.${doc.status}`)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">{t("comp.docs.empty")}</p>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-border p-5">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          {t("comp.submit.title")}
        </p>
        <label className="mt-4 block text-sm" htmlFor="sof">
          {t("comp.submit.sof")}
        </label>
        <select
          id="sof"
          value={sourceOfFunds}
          onChange={(event) => setSourceOfFunds(event.target.value)}
          className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          {sources.map((s) => (
            <option key={s.value} value={s.value}>
              {t(s.key)}
            </option>
          ))}
        </select>

        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={declaredPep}
            onChange={(event) => setDeclaredPep(event.target.checked)}
          />
          {t("comp.submit.pep")}
        </label>

        <Button
          className="mt-5"
          disabled={mutation.isPending || kycStatus === "APPROVED"}
          onClick={() => mutation.mutate()}
        >
          {kycStatus === "APPROVED" ? t("comp.submit.verified") : t("comp.submit.button")}
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">
          {t("comp.submit.hint")}
        </p>
      </section>
    </main>
  );
}