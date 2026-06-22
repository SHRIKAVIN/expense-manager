import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { usePrefersReducedMotion } from "@/lib/motion";

export interface Segment<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  ariaLabel?: string;
}

/**
 * Pill-grouped toggle. Selected segment gets solid Action Blue + white text;
 * unselected are transparent with ink-muted-80 text (§3.3).
 */
export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  className,
  ariaLabel,
}: SegmentedControlProps<T>) {
  const reduced = usePrefersReducedMotion();
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-1 rounded-pill bg-canvas-parchment p-1 border border-hairline",
        className,
      )}
    >
      {segments.map((seg) => {
        const active = seg.value === value;
        return (
          <button
            key={seg.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(seg.value)}
            className={cn(
              "relative rounded-pill px-4 py-1.5 outline-none text-button-utility transition-colors",
              active ? "text-on-primary" : "text-ink-muted-80",
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${ariaLabel ?? "default"}`}
                transition={
                  reduced ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 32 }
                }
                className="absolute inset-0 rounded-pill bg-primary"
              />
            )}
            <span className="relative z-10">{seg.label}</span>
          </button>
        );
      })}
    </div>
  );
}
