import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface SummaryStatCardProps {
  label: string;
  children: ReactNode;
  className?: string;
  "data-testid"?: string;
}

/** Compact stat tile for dashboard-style 2–3 column grids. */
export function SummaryStatCard({
  label,
  children,
  className,
  "data-testid": testId,
}: SummaryStatCardProps) {
  return (
    <div
      data-testid={testId}
      className={cn(
        "flex min-h-[5.5rem] flex-col justify-between rounded-xl border border-hairline bg-canvas px-3 py-3.5",
        "shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:min-h-[6rem] sm:px-4 sm:py-4",
        className,
      )}
    >
      <p className="text-[11px] font-medium leading-snug text-ink-muted-48 sm:text-caption">{label}</p>
      <div className="mt-2 min-w-0 text-[13px] font-semibold tabular-nums leading-tight sm:text-[15px]">
        {children}
      </div>
    </div>
  );
}
