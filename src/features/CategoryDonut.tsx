import { useMemo } from "react";
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
/** Smallest slice still gets ~12° so it stays visible on the ring. */
const MIN_SLICE_FRAC = 0.033;

export function categorySliceStyle(index: number, count: number) {
  const step = count > 1 ? 0.5 / (count - 1) : 0;
  return { opacity: 1 - index * step };
}

interface DonutSegment {
  key: string;
  dasharray: string;
  dashoffset: number;
  opacity: number;
}

function buildSegments(slices: CategorySlice[]): DonutSegment[] {
  const grand = slices.reduce((a, s) => a + s.total, 0);
  if (!grand) return [];

  let fracs = slices.map((s) => s.total / grand);
  const smallCount = fracs.filter((f) => f > 0 && f < MIN_SLICE_FRAC).length;

  if (smallCount > 0) {
    const reserved = smallCount * MIN_SLICE_FRAC;
    const largeSum = fracs.reduce((a, f) => a + (f >= MIN_SLICE_FRAC ? f : 0), 0);
    const remaining = 1 - reserved;
    fracs = fracs.map((f) => {
      if (f <= 0) return 0;
      if (f < MIN_SLICE_FRAC) return MIN_SLICE_FRAC;
      return largeSum > 0 ? (f / largeSum) * remaining : f;
    });
  }

  let offset = 0;
  const step = slices.length > 1 ? 0.5 / (slices.length - 1) : 0;

  return slices
    .map((slice, i) => {
      const frac = fracs[i] ?? 0;
      if (frac <= 0) return null;

      const len = frac * C;
      const seg: DonutSegment = {
        key: slice.categoryId,
        dasharray: `${len} ${C - len}`,
        dashoffset: -offset,
        opacity: 1 - i * step,
      };
      offset += len;
      return seg;
    })
    .filter((seg): seg is DonutSegment => seg !== null);
}

/**
 * Lightweight, dependency-free donut (keeps Recharts out of the initial bundle).
 * Segments use Action Blue at stepped opacities; tiny categories get a minimum arc.
 */
export function CategoryDonut({ slices, currency, total, animate = true }: CategoryDonutProps) {
  const reduced = usePrefersReducedMotion();
  const grand = slices.reduce((a, s) => a + s.total, 0);
  const segments = useMemo(() => buildSegments(slices), [slices]);

  return (
    <div className="relative mx-auto h-52 w-52">
      <svg
        key={grand}
        viewBox="0 0 120 120"
        className="h-full w-full -rotate-90"
        aria-hidden
      >
        <circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke="var(--color-hairline)"
          strokeWidth="16"
        />
        {segments.map((seg) => (
          <motion.circle
            key={seg.key}
            cx="60"
            cy="60"
            r={R}
            fill="none"
            stroke="var(--color-primary-focus)"
            strokeOpacity={seg.opacity}
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={seg.dasharray}
            initial={animate && !reduced ? { strokeDashoffset: C } : false}
            animate={{ strokeDashoffset: seg.dashoffset, strokeDasharray: seg.dasharray }}
            transition={{ duration: reduced ? 0 : 0.55, ease: "easeOut" }}
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
