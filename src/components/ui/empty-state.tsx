import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Global empty placeholder for lists, tables and panels. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background-secondary/60 px-6 py-10 text-center",
        className,
      )}
    >
      {Icon ? <Icon className="size-6 text-text-muted" aria-hidden /> : null}
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description ? <p className="text-xs text-text-secondary">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}