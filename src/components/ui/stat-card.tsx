import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** Global KPI tile. One design used across dashboard, wallet and admin. */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "success" | "warning" | "danger" | "info";
  className?: string;
}) {
  const toneClass = {
    default: "text-foreground",
    success: "text-success",
    warning: "text-warning",
    danger: "text-destructive",
    info: "text-info",
  }[tone];

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4 transition-colors duration-200 hover:bg-card-hover",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-text-muted">{label}</p>
        {Icon ? <Icon className="size-4 text-text-secondary" aria-hidden /> : null}
      </div>
      <p className={cn("mt-2 font-display text-2xl font-bold tabular-nums", toneClass)}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-text-secondary">{hint}</p> : null}
    </div>
  );
}