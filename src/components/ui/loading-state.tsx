import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

/** Global skeleton loader used while data resolves. */
export function LoadingState({ rows = 3, className }: { rows?: number; className?: string }) {
  const { t } = useI18n();
  return (
    <div className={cn("space-y-2", className)} role="status" aria-label={t("ui.loading")}>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="skeleton-line h-10 w-full" />
      ))}
    </div>
  );
}