import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Global page title block used at the top of every page. */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-sm text-text-secondary">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}