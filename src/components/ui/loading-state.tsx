import { cn } from "@/lib/utils";

/** Global skeleton loader used while data resolves. */
export function LoadingState({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="skeleton-line h-10 w-full" />
      ))}
    </div>
  );
}