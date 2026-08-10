import { useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, FileUp, Lock, ShieldCheck, UserRound } from "lucide-react";

import { AccountNav } from "@/components/account/AccountNav";
import { Button } from "@/components/ui/button";
import {
  getComplianceStatus,
  submitKyc,
  uploadKycDocument,
} from "@/lib/compliance.functions";
import { useI18n } from "@/lib/i18n";

const title = "Identity Verification — AstroBet";
const description =
  "Verify your identity to keep your account secure and unlock withdrawals. Upload your ID, complete face verification and track your review status.";

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

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,application/pdf";

const idTypes = [
  { value: "PASSPORT", key: "kyc.docType.passport", back: false },
  { value: "NATIONAL_ID", key: "kyc.docType.nationalId", back: true },
  { value: "DRIVING_LICENSE", key: "kyc.docType.license", back: true },
] as const;

function readAsBase64(file: File, message: string) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(message));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.readAsDataURL(file);
  });
}

type Tone = "done" | "active" | "pending" | "failed";

function Dot({ tone }: { tone: Tone }) {
  const cls =
    tone === "done"
      ? "bg-success"
      : tone === "active"
        ? "bg-warning"
        : tone === "failed"
          ? "bg-destructive"
          : "bg-muted-foreground/40";
  return <span className={`inline-block size-2.5 shrink-0 rounded-full ${cls}`} aria-hidden />;
}

function CompliancePage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const fetchStatus = useServerFn(getComplianceStatus);
  const submit = useServerFn(submitKyc);
  const upload = useServerFn(uploadKycDocument);

  const [idType, setIdType] = useState<string>("NATIONAL_ID");
  const [busy, setBusy] = useState<string | null>(null);
  const inputs = {
    ID_FRONT: useRef<HTMLInputElement>(null),
    ID_BACK: useRef<HTMLInputElement>(null),
    SELFIE: useRef<HTMLInputElement>(null),
    PROOF_OF_ADDRESS: useRef<HTMLInputElement>(null),
  } as const;

  const status = useQuery({
    queryKey: ["compliance", "status"],
    queryFn: async () => fetchStatus({ data: undefined }),
  });

  const data = status.data;
  const kycStatus = data?.kyc?.status ?? "NOT_STARTED";
  const verified = kycStatus === "APPROVED";
  const rejected = kycStatus === "REJECTED";
  const documents = useMemo(() => data?.documents ?? [], [data]);
  const has = (type: string) => documents.some((d) => d.doc_type === type);
  const needsAddress =
    data?.kyc?.risk_level === "HIGH" ||
    data?.kyc?.risk_level === "REVIEW_REQUIRED" ||
    kycStatus === "REQUIRES_INFORMATION";

  const personalDone = verified || Boolean(data?.countryCode && data?.dateOfBirth);
  const identityDone = verified || has("ID_FRONT");
  const submitted = Boolean(data?.kyc?.submitted_at);

  const uploadMutation = useMutation({
    mutationFn: async ({ file, docType }: { file: File; docType: string }) => {
      if (file.size > MAX_BYTES) throw new Error(t("kyc.error.size"));
      const contentBase64 = await readAsBase64(file, t("comp.error.fileRead"));
      return upload({
        data: { docType, fileName: file.name, mimeType: file.type, contentBase64 },
      });
    },
    onSuccess: () => {
      toast.success(t("comp.toast.uploaded"));
      void queryClient.invalidateQueries({ queryKey: ["compliance"] });
    },
    onError: (error: Error) => toast.error(error.message),
    onSettled: () => setBusy(null),
  });

  const submitMutation = useMutation({
    mutationFn: async () => submit({ data: { sourceOfFunds: "EMPLOYMENT", declaredPep: false } }),
    onSuccess: (result) => {
      toast.success(`${t("kyc.heading")} — ${t(`comp.status.${result.status}`)}`);
      void queryClient.invalidateQueries({ queryKey: ["compliance"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const pick = (docType: keyof typeof inputs) => {
    setBusy(docType);
    inputs[docType].current?.click();
  };

  const uploadSlot = (docType: keyof typeof inputs, label: string) => {
    const uploaded = has(docType);
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/40 p-4 text-center">
        <input
          ref={inputs[docType]}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) uploadMutation.mutate({ file, docType });
            else setBusy(null);
          }}
        />
        <p className="text-sm font-medium">{label}</p>
        {uploaded ? (
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-success">
            <Check className="size-3.5" aria-hidden /> {t("kyc.upload.uploaded")}
          </p>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">{t("kyc.upload.none")}</p>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          disabled={uploadMutation.isPending}
          onClick={() => pick(docType)}
        >
          <FileUp className="size-4" aria-hidden />
          {uploadMutation.isPending && busy === docType
            ? t("comp.docs.uploading")
            : uploaded
              ? t("kyc.upload.replace")
              : t("kyc.upload.button")}
        </Button>
      </div>
    );
  };

  const row = (label: string, value: string | null | undefined) => (
    <div className="flex items-center justify-between gap-4 border-b border-border/50 py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value || "—"}</span>
    </div>
  );

  const statusTone = verified
    ? "border-success/40 text-success"
    : rejected
      ? "border-destructive/40 text-destructive"
      : "border-warning/40 text-warning";

  const steps: { label: string; tone: Tone }[] = [
    { label: t("kyc.step.personal"), tone: personalDone ? "done" : "active" },
    {
      label: t("kyc.step.identity"),
      tone: identityDone ? "done" : personalDone ? "active" : "pending",
    },
    {
      label: t("kyc.step.review"),
      tone: verified ? "done" : rejected ? "failed" : submitted ? "active" : "pending",
    },
    { label: t("kyc.step.approved"), tone: verified ? "done" : "pending" },
  ];

  return (
    <main className="mx-auto w-full max-w-4xl px-4 pb-16 pt-8">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{t("kyc.heading")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("kyc.subtitle")}</p>
      <AccountNav />

      {/* Overview */}
      <section className="mt-8 rounded-2xl border border-border bg-card/60 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-6 text-primary" aria-hidden />
            <div>
              <p className="text-lg font-semibold">{t("kyc.overview.title")}</p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">{t("kyc.overview.body")}</p>
            </div>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs ${statusTone}`}>
            {t("kyc.status.label")}: {t(`comp.status.${kycStatus}`)}
          </span>
        </div>

        <ol className="mt-6 grid gap-3 sm:grid-cols-4">
          {steps.map((step, index) => (
            <li key={step.label} className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/40 px-3 py-2 text-xs">
              <Dot tone={step.tone} />
              <span className="font-medium">
                {index + 1}. {step.label}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* Withdrawal restriction */}
      {!verified ? (
        <section className="mt-6 rounded-2xl border border-warning/40 bg-warning/5 p-5">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Lock className="size-4 text-warning" aria-hidden /> {t("kyc.withdraw.title")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{t("kyc.withdraw.body")}</p>
        </section>
      ) : null}

      {/* Rejection reason */}
      {rejected && data?.kyc?.rejection_reason ? (
        <section className="mt-6 rounded-2xl border border-destructive/40 bg-destructive/5 p-5">
          <p className="text-sm font-semibold text-destructive">{t("kyc.rejected.title")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{data.kyc.rejection_reason}</p>
          <Button className="mt-4" variant="outline" onClick={() => pick("ID_FRONT")}>
            {t("kyc.rejected.action")}
          </Button>
        </section>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        {/* Personal information */}
        <section className="rounded-2xl border border-border p-5">
          <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <UserRound className="size-4" aria-hidden /> {t("kyc.personal.title")}
          </p>
          <div className="mt-4">
            {row(t("kyc.personal.firstName"), data?.personal?.firstName)}
            {row(t("kyc.personal.lastName"), data?.personal?.lastName)}
            {row(t("kyc.personal.dob"), data?.dateOfBirth)}
            {row(t("kyc.personal.country"), data?.countryCode)}
            {row(t("kyc.personal.phone"), data?.personal?.phone)}
            {row(t("kyc.personal.email"), data?.personal?.email)}
            {row(t("kyc.personal.currency"), data?.personal?.currency)}
          </div>
          <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Lock className="size-3.5" aria-hidden /> {t("kyc.personal.locked")}
          </p>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link to="/support">{t("kyc.personal.requestChange")}</Link>
          </Button>
        </section>

        <div className="space-y-6">
          {/* Identity document */}
          <section className="rounded-2xl border border-border p-5">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              {t("kyc.identity.title")}
            </p>
            <label className="mt-4 block text-sm" htmlFor="id-type">
              {t("kyc.identity.type")}
            </label>
            <select
              id="id-type"
              value={idType}
              onChange={(event) => setIdType(event.target.value)}
              className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              {idTypes.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.key)}
                </option>
              ))}
            </select>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {uploadSlot("ID_FRONT", t("kyc.identity.front"))}
              {idTypes.find((o) => o.value === idType)?.back
                ? uploadSlot("ID_BACK", t("kyc.identity.back"))
                : null}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{t("kyc.identity.formats")}</p>

            <Button
              className="mt-4"
              disabled={!identityDone || submitMutation.isPending || verified}
              onClick={() => submitMutation.mutate()}
            >
              {verified ? t("comp.submit.verified") : t("kyc.identity.submit")}
            </Button>
          </section>

          {/* Face verification */}
          <section className="rounded-2xl border border-border p-5">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              {t("kyc.face.title")}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{t("kyc.face.body")}</p>
            <div className="mt-4">{uploadSlot("SELFIE", t("kyc.face.slot"))}</div>
          </section>

          {/* Proof of address — only when required */}
          {needsAddress ? (
            <section className="rounded-2xl border border-border p-5">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                {t("kyc.address.title")}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{t("kyc.address.body")}</p>
              <div className="mt-4">{uploadSlot("PROOF_OF_ADDRESS", t("kyc.address.slot"))}</div>
            </section>
          ) : null}
        </div>
      </div>

      {/* Verification status timeline */}
      <section className="mt-6 rounded-2xl border border-border p-5">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          {t("kyc.timeline.title")}
        </p>
        <ul className="mt-4 space-y-3 text-sm">
          {[
            {
              label: t("kyc.step.personal"),
              tone: (personalDone ? "done" : "pending") as Tone,
              detail: personalDone ? t("kyc.timeline.completed") : t("kyc.timeline.pending"),
            },
            {
              label: t("kyc.step.identity"),
              tone: (identityDone ? "done" : "pending") as Tone,
              detail: identityDone ? t("kyc.timeline.submitted") : t("kyc.timeline.pending"),
            },
            {
              label: t("kyc.step.review"),
              tone: (verified ? "done" : rejected ? "failed" : submitted ? "active" : "pending") as Tone,
              detail: rejected
                ? t("kyc.timeline.rejected")
                : verified
                  ? t("kyc.timeline.completed")
                  : submitted
                    ? t("kyc.timeline.underReview")
                    : t("kyc.timeline.pending"),
            },
            {
              label: t("kyc.step.approved"),
              tone: (verified ? "done" : "pending") as Tone,
              detail: verified ? t("kyc.timeline.completed") : t("kyc.timeline.pending"),
            },
          ].map((item) => (
            <li key={item.label} className="flex items-center gap-3 rounded-lg border border-border/60 bg-card/40 px-3 py-2">
              <Dot tone={item.tone} />
              <span className="flex-1 font-medium">{item.label}</span>
              <span className="text-xs text-muted-foreground">{item.detail}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Requirements */}
      <section className="mt-6 rounded-2xl border border-border p-5">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          {t("kyc.requirements.title")}
        </p>
        <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          {[
            "kyc.requirements.valid",
            "kyc.requirements.nameMatch",
            "kyc.requirements.readable",
            "kyc.requirements.corners",
            "kyc.requirements.noScreenshots",
            "kyc.requirements.notExpired",
          ].map((key) => (
            <li key={key} className="flex items-start gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              <span>{t(key)}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Help */}
      <section className="mt-6 rounded-2xl border border-border p-5">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{t("kyc.help.title")}</p>
        <p className="mt-2 text-sm text-muted-foreground">{t("kyc.help.body")}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/support">{t("kyc.help.action")}</Link>
        </Button>
      </section>
    </main>
  );
}
