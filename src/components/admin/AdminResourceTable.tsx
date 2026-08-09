import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw } from "lucide-react";

import { useI18n } from "@/lib/i18n";
import { listOpsResource } from "@/lib/admin-ops.functions";

function render(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "✓" : "✕";
  if (typeof value === "number") return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) return new Date(text).toLocaleString();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(text)) return `${text.slice(0, 8)}…`;
  return text.length > 48 ? `${text.slice(0, 48)}…` : text;
}

function humanize(column: string): string {
  return column.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

/** Read-only operational listing shared by every data-backed back-office section. */
export function AdminResourceTable({
  resource,
  title,
  subtitle,
  limit = 50,
}: {
  resource: string;
  title: string;
  subtitle?: string;
  limit?: number;
}) {
  const { t } = useI18n();
  const fetchResource = useServerFn(listOpsResource);
  const query = useQuery({
    queryKey: ["admin", "ops", resource, limit],
    queryFn: async () => fetchResource({ data: { resource, limit } }),
  });

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-black tracking-tight">{title}</h1>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => void query.refetch()}
          className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-secondary/60"
        >
          <RefreshCw className={`size-3.5 ${query.isFetching ? "animate-spin" : ""}`} aria-hidden />
          {t("admin.res.refresh")}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card/60">
        {query.isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">{t("admin.loading")}</p>
        ) : query.isError ? (
          <p className="p-4 text-sm text-destructive">{(query.error as Error).message}</p>
        ) : (query.data?.rows.length ?? 0) === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">{t("admin.res.empty")}</p>
        ) : (
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border/70 text-[11px] uppercase tracking-wide text-muted-foreground">
                {(query.data?.columns ?? []).map((column) => (
                  <th key={column} className="whitespace-nowrap px-3 py-2 text-start font-semibold">
                    {humanize(column)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(query.data?.rows ?? []).map((row, index) => (
                <tr key={index} className="border-b border-border/40 last:border-0 hover:bg-secondary/30">
                  {(query.data?.columns ?? []).map((column) => (
                    <td key={column} className="whitespace-nowrap px-3 py-2 tabular-nums">
                      {render((row as Record<string, unknown>)[column])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">{t("admin.res.readOnly")}</p>
    </section>
  );
}
