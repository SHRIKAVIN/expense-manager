import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface SummaryStatCardProps {
  label: string;
  children: ReactNode;
  className?: string;
  "data-testid"?: string;
}

/** Elevated stat tile for dashboard summary grids. */
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
        "flex flex-col justify-start gap-1 rounded-2xl bg-canvas px-3 py-3 sm:px-4 sm:py-3.5",
        "shadow-[0_6px_20px_rgba(0,0,0,0.1),0_2px_8px_rgba(0,0,0,0.06)]",
        "dark:shadow-[0_6px_20px_rgba(0,0,0,0.4),0_2px_8px_rgba(0,0,0,0.25)]",
        className,
      )}
    >
      <p className="text-[11px] font-bold leading-snug text-ink-muted-48 sm:text-[13px]">{label}</p>
      <div className="min-w-0 text-[15px] font-bold tabular-nums leading-none tracking-tight sm:text-[22px] lg:text-[26px]">
        {children}
      </div>
    </div>
  );
}
