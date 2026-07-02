import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { CategorySlice } from "@/lib/analytics";
import type { Expense } from "@/lib/types";
import {
  formatCategoryShare,
  formatCompactAmount,
  formatCurrency,
} from "@/lib/format";
import { usePrefersReducedMotion } from "@/lib/motion";

interface CategoryDonutProps {
  slices: CategorySlice[];
  expenses: Expense[];
  currency: string;
  total: number;
  monthLabel: string;
  animate?: boolean;
}

/** Reference sunburst palette (sky → orange → sage → gold → royal → lime → navy → brown). */
export const CATEGORY_CHART_COLORS = [
  "#0066cc",
  "#D87A4A",
  "#94A88A",
  "#E5BC3A",
  "#4A72C4",
  "#BFD042",
  "#3D5278",
  "#9A7348",
] as const;

export function categoryChartColor(index: number): string {
  return CATEGORY_CHART_COLORS[index % CATEGORY_CHART_COLORS.length];
}

export function categorySliceStyle(index: number, count: number) {
  const step = count > 1 ? 0.5 / (count - 1) : 0;
  return { opacity: 1 - index * step };
}

const CX = 60;
const CY = 60;
const OUTER_R = 53;
const INNER_R = 39;
const MAX_HOVER_EXPENSES = 4;

interface DonutSegment {
  key: string;
  path: string;
  color: string;
  slice: CategorySlice;
  index: number;
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(startDeg: number, endDeg: number): string {
  const sweep = Math.min(endDeg - startDeg, 359.99);
  const end = startDeg + sweep;
  const outerStart = polar(CX, CY, OUTER_R, startDeg);
  const outerEnd = polar(CX, CY, OUTER_R, end);
  const innerEnd = polar(CX, CY, INNER_R, end);
  const innerStart = polar(CX, CY, INNER_R, startDeg);
  const large = sweep > 180 ? 1 : 0;
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${OUTER_R} ${OUTER_R} 0 ${large} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${INNER_R} ${INNER_R} 0 ${large} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

function buildSegments(slices: CategorySlice[]): DonutSegment[] {
  const grand = slices.reduce((a, s) => a + s.total, 0);
  if (!grand) return [];

  let angle = 0;
  return slices
    .map((slice, index) => {
      if (slice.total <= 0) return null;
      const sweep = (slice.total / grand) * 360;
      const start = angle;
      angle += sweep;
      return {
        key: slice.categoryId,
        path: arcPath(start, angle),
        color: categoryChartColor(index),
        slice,
        index,
      };
    })
    .filter((seg): seg is DonutSegment => seg !== null);
}

function expensesForCategory(expenses: Expense[], categoryId: string): Expense[] {
  return expenses
    .filter((e) => e.categoryId === categoryId)
    .sort((a, b) => b.amount - a.amount || b.date.localeCompare(a.date));
}

export function CategoryDonut({
  slices,
  expenses,
  currency,
  total,
  monthLabel,
  animate = true,
}: CategoryDonutProps) {
  const reduced = usePrefersReducedMotion();
  const grand = slices.reduce((a, s) => a + s.total, 0);
  const segments = useMemo(() => buildSegments(slices), [slices]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const hoveredSlice = segments.find((s) => s.key === hoveredId)?.slice ?? null;
  const hoveredExpenses = hoveredId ? expensesForCategory(expenses, hoveredId) : [];
  const visibleExpenses = hoveredExpenses.slice(0, MAX_HOVER_EXPENSES);
  const moreCount = hoveredExpenses.length - visibleExpenses.length;

  const setHover = (id: string | null) => setHoveredId(id);

  return (
    <div className="flex flex-col">
      <div>
        <h2 className="text-body-strong text-ink">Spending by category</h2>
        <p className="text-caption text-ink-muted-48 mt-0.5">
          Source: expense log · {monthLabel}
        </p>
      </div>

      <div
        className="relative mx-auto mt-6 h-56 w-56"
        onMouseLeave={() => setHover(null)}
      >
        <svg viewBox="0 0 120 120" className="h-full w-full" role="img">
          <title>Spending by category</title>
          <circle
            cx={CX}
            cy={CY}
            r={(OUTER_R + INNER_R) / 2}
            fill="none"
            stroke="var(--color-hairline)"
            strokeWidth={OUTER_R - INNER_R}
          />
          {segments.map((seg) => {
            const active = !hoveredId || hoveredId === seg.key;
            return (
              <motion.path
                key={seg.key}
                d={seg.path}
                fill={seg.color}
                stroke="var(--color-canvas)"
                strokeWidth={1}
                className="cursor-pointer outline-none"
                style={{ opacity: active ? 1 : 0.35 }}
                initial={animate && !reduced ? { opacity: 0 } : false}
                animate={{ opacity: active ? 1 : 0.35 }}
                transition={{ duration: reduced ? 0 : 0.35, ease: "easeOut" }}
                onMouseEnter={() => setHover(seg.key)}
                onFocus={() => setHover(seg.key)}
                onBlur={() => setHover(null)}
                onClick={() => setHover(hoveredId === seg.key ? null : seg.key)}
                tabIndex={0}
                aria-label={`${seg.slice.name}, ${formatCurrency(seg.slice.total, currency)}`}
              />
            );
          })}
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-3 text-center">
          {hoveredSlice ? (
            <>
              <span className="text-caption text-ink-muted-48">{hoveredSlice.name}</span>
              <span className="text-body-strong text-ink tabular-nums leading-tight mt-0.5">
                {formatCurrency(hoveredSlice.total, currency)}
              </span>
              <span className="text-caption text-ink-muted-48 mt-0.5">
                {formatCategoryShare(hoveredSlice.total, grand)}
              </span>
            </>
          ) : (
            <>
              <span className="text-display-md text-ink tabular-nums leading-none">
                {formatCompactAmount(total, currency)}
              </span>
              <span className="text-caption text-ink-muted-48 mt-1">Total</span>
            </>
          )}
        </div>
      </div>

      {hoveredSlice && visibleExpenses.length > 0 && (
        <div
          className="mx-auto mt-4 w-full max-w-sm rounded-md border border-hairline bg-canvas-parchment px-4 py-3"
          data-testid="dashboard-donut-hover-expenses"
        >
          <p className="text-caption-strong text-ink-muted-48 mb-2">
            Expenses in {hoveredSlice.name}
          </p>
          <ul className="flex flex-col gap-1.5">
            {visibleExpenses.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 text-caption">
                <span className="text-ink truncate">{e.merchant}</span>
                <span className="text-ink-muted-80 tabular-nums shrink-0">
                  {formatCurrency(e.amount, currency)}
                </span>
              </li>
            ))}
          </ul>
          {moreCount > 0 && (
            <p className="text-caption text-ink-muted-48 mt-2">+{moreCount} more</p>
          )}
        </div>
      )}

      {slices.length > 0 && (
        <div
          className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2.5 px-1"
          data-testid="dashboard-donut-legend"
        >
          {slices.map((s, i) => {
            const active = hoveredId === s.categoryId;
            return (
              <button
                key={s.categoryId}
                type="button"
                className={
                  active
                    ? "flex items-center gap-2 rounded-md bg-canvas-parchment px-2 py-1 outline-none"
                    : "flex items-center gap-2 rounded-md px-2 py-1 outline-none opacity-80 hover:opacity-100"
                }
                onMouseEnter={() => setHover(s.categoryId)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(s.categoryId)}
                onBlur={() => setHover(null)}
                onClick={() => setHover(hoveredId === s.categoryId ? null : s.categoryId)}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: categoryChartColor(i) }}
                  aria-hidden
                />
                <span className="text-caption text-ink-muted-80 tabular-nums">
                  {s.name}{" "}
                  <span className="text-ink-muted-48">{formatCategoryShare(s.total, grand)}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
