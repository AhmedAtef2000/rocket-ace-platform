import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  deleteDepositDestination,
  listDepositDestinations,
  saveDepositDestination,
} from "@/lib/backoffice.functions";

type Draft = {
  id: string | null;
  kind: "CRYPTO" | "MANUAL";
  currency: string;
  channel: string;
  label: string;
  address: string;
  memo: string;
  instructions: string;
  active: boolean;
  sortOrder: number;
};

const blank: Draft = {
  id: null,
  kind: "CRYPTO",
  currency: "USDT",
  channel: "TRON",
  label: "",
  address: "",
  memo: "",
  instructions: "",
  active: true,
  sortOrder: 0,
};

function Input({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
    </label>
  );
}

/** Operator-editable wallet addresses and cash phone numbers for deposits. */
export function DepositDestinations() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const fetchAll = useServerFn(listDepositDestinations);
  const save = useServerFn(saveDepositDestination);
  const remove = useServerFn(deleteDepositDestination);

  const [draft, setDraft] = useState<Draft | null>(null);

  const rows = useQuery({
    queryKey: ["admin", "deposit-destinations"],
    queryFn: async () => fetchAll({ data: undefined }),
  });

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ["admin", "deposit-destinations"] });

  const saving = useMutation({
    mutationFn: async (input: Draft) => save({ data: input }),
    onSuccess: () => {
      toast.success(t("admin.dest.saved"));
      setDraft(null);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleting = useMutation({
    mutationFn: async (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success(t("admin.dest.removed"));
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const set =
    <K extends keyof Draft>(key: K) =>
    (value: Draft[K]) =>
      setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-medium">{t("admin.dest.title")}</h2>
          <p className="text-xs text-muted-foreground">{t("admin.dest.subtitle")}</p>
        </div>
        <Button variant="outline" onClick={() => setDraft({ ...blank })}>
          {t("admin.dest.add")}
        </Button>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-160 text-sm">
          <thead className="bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">{t("admin.dest.kind")}</th>
              <th className="px-3 py-2">{t("admin.dest.currency")}</th>
              <th className="px-3 py-2">{t("admin.dest.channel")}</th>
              <th className="px-3 py-2">{t("admin.dest.address")}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {(rows.data ?? []).length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  {t("admin.dest.empty")}
                </td>
              </tr>
            ) : (
              (rows.data ?? []).map((row) => (
                <tr key={row.id} className="border-t border-border/70">
                  <td className="px-3 py-2">
                    {row.kind === "CRYPTO" ? t("admin.dest.kind.crypto") : t("admin.dest.kind.manual")}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{row.currency}</td>
                  <td className="px-3 py-2">
                    <span className="font-medium">{row.label || row.channel}</span>
                    <span className="block font-mono text-[11px] text-muted-foreground">{row.channel}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="block max-w-72 truncate font-mono text-xs">{row.address}</span>
                    {row.active ? null : (
                      <span className="text-[11px] text-destructive">{t("admin.dest.inactive")}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-end">
                    <span className="inline-flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setDraft({
                            id: row.id,
                            kind: row.kind === "MANUAL" ? "MANUAL" : "CRYPTO",
                            currency: row.currency,
                            channel: row.channel,
                            label: row.label ?? "",
                            address: row.address,
                            memo: row.memo ?? "",
                            instructions: row.instructions ?? "",
                            active: row.active,
                            sortOrder: row.sort_order,
                          })
                        }
                      >
                        {t("admin.dest.edit")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={deleting.isPending}
                        onClick={() => {
                          if (window.confirm(t("admin.dest.confirmRemove"))) deleting.mutate(row.id);
                        }}
                      >
                        {t("admin.dest.remove")}
                      </Button>
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {draft ? (
        <div className="mt-4 grid gap-3 rounded-xl border border-border p-5 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("admin.dest.kind")}
            </span>
            <select
              value={draft.kind}
              onChange={(e) => set("kind")(e.target.value as Draft["kind"])}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="CRYPTO">{t("admin.dest.kind.crypto")}</option>
              <option value="MANUAL">{t("admin.dest.kind.manual")}</option>
            </select>
          </label>
          <Input
            label={t("admin.dest.currency")}
            value={draft.currency}
            onChange={set("currency")}
            placeholder={draft.kind === "CRYPTO" ? "USDT" : "EGP"}
          />
          <Input
            label={t("admin.dest.channel")}
            value={draft.channel}
            onChange={set("channel")}
            placeholder={draft.kind === "CRYPTO" ? "TRON" : "VODAFONE_CASH"}
          />
          <Input label={t("admin.dest.label")} value={draft.label} onChange={set("label")} />
          <Input
            label={draft.kind === "CRYPTO" ? t("admin.dest.address") : t("admin.dest.phone")}
            value={draft.address}
            onChange={set("address")}
            placeholder={draft.kind === "CRYPTO" ? "TVx…" : "+20 100 000 0000"}
          />
          <Input label={t("admin.dest.memo")} value={draft.memo} onChange={set("memo")} />
          <Input
            label={t("admin.dest.instructions")}
            value={draft.instructions}
            onChange={set("instructions")}
          />
          <Input
            label={t("admin.dest.sort")}
            value={String(draft.sortOrder)}
            onChange={(v) => set("sortOrder")(Number(v) || 0)}
          />
          <label className="flex items-center gap-2 self-end text-sm">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => set("active")(e.target.checked)}
            />
            {t("admin.dest.active")}
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <Button disabled={saving.isPending} onClick={() => saving.mutate(draft)}>
              {saving.isPending ? t("admin.dest.saving") : t("admin.dest.save")}
            </Button>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              {t("admin.dest.cancel")}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
