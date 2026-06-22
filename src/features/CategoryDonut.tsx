import { motion } from "framer-motion";
import type { CategorySlice } from "@/lib/analytics";
import { formatCurrency } from "@/lib/format";
import { usePrefersReducedMotion } from "@/lib/motion";

interface CategoryDonutProps {
  slices: CategorySlice[];
  currency: string;
  total: number;
  animate?: boolean;
}

const R = 46;
const C = 2 * Math.PI * R;
const GAP = 3; // small visual gap between segments

/**
 * Lightweight, dependency-free donut (keeps Recharts out of the initial bundle).
 * Monochrome: a single Action Blue hue differentiated by opacity (no 2nd color).
 */
export function CategoryDonut({ slices, currency, total, animate = true }: CategoryDonutProps) {
  const reduced = usePrefersReducedMotion();
  const grand = slices.reduce((a, s) => a + s.total, 0);
  const step = slices.length > 1 ? 0.6 / (slices.length - 1) : 0;

  let offset = 0;
  const segments = grand
    ? slices.map((s, i) => {
        const frac = s.total / grand;
        const len = frac * C;
        const seg = {
          key: s.categoryId,
          dasharray: `${Math.max(len - GAP, 0)} ${C - Math.max(len - GAP, 0)}`,
          dashoffset: -offset,
          opacity: 1 - i * step,
        };
        offset += len;
        return seg;
      })
    : [];

  return (
    <div className="relative h-48 w-48 mx-auto">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke="var(--color-divider-soft)"
          strokeWidth="14"
        />
        {segments.map((seg) => (
          <motion.circle
            key={seg.key}
            cx="60"
            cy="60"
            r={R}
            fill="none"
            stroke="var(--color-primary)"
            strokeOpacity={seg.opacity}
            strokeWidth="14"
            strokeLinecap="butt"
            strokeDasharray={seg.dasharray}
            initial={animate && !reduced ? { strokeDashoffset: C } : false}
            animate={{ strokeDashoffset: seg.dashoffset }}
            transition={{ duration: reduced ? 0 : 0.6, ease: "easeOut" }}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-caption text-ink-muted-48">Spent</span>
        <span className="text-body-strong text-ink">{formatCurrency(total, currency)}</span>
      </div>
    </div>
  );
}
