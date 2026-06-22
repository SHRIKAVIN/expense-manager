import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { usePrefersReducedMotion } from "@/lib/motion";

interface ProgressBarProps {
  /** 0..1 (values above 1 are clamped for the fill but flagged via `over`). */
  value: number;
  className?: string;
}

/**
 * Budget progress. rounded-full track in divider-soft, Action Blue fill.
 * Over-budget is signalled with a striped overlay (NOT a second color, §3.2).
 */
export function ProgressBar({ value, className }: ProgressBarProps) {
  const reduced = usePrefersReducedMotion();
  const over = value > 1;
  const pct = Math.max(0, Math.min(1, value)) * 100;

  return (
    <div
      className={cn("h-2 w-full rounded-full bg-divider-soft overflow-hidden", className)}
      role="progressbar"
      aria-valuenow={Math.round(value * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <motion.div
        className="h-full rounded-full bg-primary"
        style={
          over
            ? {
                backgroundImage:
                  "repeating-linear-gradient(45deg, var(--color-primary) 0 6px, var(--color-primary-focus) 6px 12px)",
              }
            : undefined
        }
        initial={reduced ? false : { width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 200, damping: 30 }}
      />
    </div>
  );
}
