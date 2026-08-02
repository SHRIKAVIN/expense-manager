import { useEffect, useState } from "react";
import { Sheet } from "@/components/Sheet";
import { ProgressBar } from "@/components/ProgressBar";
import { CategoryGlyph } from "@/lib/icons";
import { formatCurrency } from "@/lib/format";
import type { Category, IncomeEntry } from "@/lib/types";
import type { CategorySlice } from "@/lib/analytics";

export type DashboardSummaryKind = "income" | "spent" | "remaining" | "budget";

interface DashboardSummarySheetProps {
  kind: DashboardSummaryKind | null;
  onClose: () => void;
  monthLabel: string;
  currency: string;
  /** Income */
  incomeEntries?: IncomeEntry[];
  incomeTotal?: number;
  /** Spent */
  spentTotal?: number;
  expenseCount?: number;
  slices?: CategorySlice[];
  /** Remaining */
  remainingTotal?: number;
  /** Budget */
  budgeted?: Category[];
  budgetSpentByCategory?: Record<string, number>;
  budgetTotals?: { totalLimit: number; totalSpentBudgeted: number };
}

export function DashboardSummarySheet({
  kind,
  onClose,
  monthLabel,
  currency,
  incomeEntries = [],
  incomeTotal = 0,
  spentTotal = 0,
  expenseCount = 0,
  slices = [],
  remainingTotal = 0,
  budgeted = [],
  budgetSpentByCategory = {},
  budgetTotals = { totalLimit: 0, totalSpentBudgeted: 0 },
}: DashboardSummarySheetProps) {
  const [cachedKind, setCachedKind] = useState<DashboardSummaryKind | null>(kind);

  useEffect(() => {
    if (kind) setCachedKind(kind);
  }, [kind]);

  const shown = kind ?? cachedKind;
  if (!shown) return null;

  const title =
    shown === "income"
      ? `Income · ${monthLabel}`
      : shown === "spent"
        ? `Spent · ${monthLabel}`
        : shown === "remaining"
          ? `Remaining · ${monthLabel}`
          : `Budget health · ${monthLabel}`;

  return (
    <Sheet open={kind !== null} onClose={onClose} title={title}>
      {shown === "income" && (
        <div className="flex flex-col items-center text-center gap-4">
          <p className="text-display-md text-primary tabular-nums text-center">
            {formatCurrency(incomeTotal, currency)}
          </p>
          {incomeEntries.length === 0 ? (
            <p className="text-body text-ink-muted-48 text-center">No income recorded this month.</p>
          ) : (
            <ul className="flex flex-col gap-3 w-full">
              {incomeEntries.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-3">
                  <span className="text-body text-ink truncate">
                    {entry.label?.trim() || "Income"}
                  </span>
                  <span className="text-body-strong text-primary tabular-nums shrink-0">
                    +{formatCurrency(entry.amount, currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {shown === "spent" && (
        <div className="flex flex-col items-center text-center gap-4">
          <div className="text-center">
            <p className="text-display-md text-amber-700 tabular-nums text-center">
              {formatCurrency(spentTotal, currency)}
            </p>
            <p className="text-caption text-ink-muted-48 mt-1 text-center">
              {expenseCount} transaction{expenseCount === 1 ? "" : "s"}
            </p>
          </div>
          {slices.length === 0 ? (
            <p className="text-body text-ink-muted-48 text-center">No spending this month.</p>
          ) : (
            <ul className="flex flex-col gap-3 w-full">
              {slices.map((s) => (
                <li key={s.categoryId} className="flex items-center gap-3">
                  <span className="text-ink-muted-80 shrink-0">
                    <CategoryGlyph icon={s.icon} size={18} />
                  </span>
                  <span className="text-body text-ink flex-1 truncate text-left">{s.name}</span>
                  <span className="text-body-strong text-red-600 tabular-nums shrink-0">
                    {formatCurrency(s.total, currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {shown === "remaining" && (
        <div className="flex flex-col items-center text-center gap-4">
          <p
            className={`text-display-md tabular-nums text-center ${
              remainingTotal >= 0 ? "text-emerald-600" : "text-red-600"
            }`}
          >
            {formatCurrency(remainingTotal, currency)}
          </p>
          <ul className="flex flex-col gap-3 w-full">
            <li className="flex items-center justify-between gap-3">
              <span className="text-body text-ink">Income</span>
              <span className="text-body-strong text-primary tabular-nums shrink-0">
                +{formatCurrency(incomeTotal, currency)}
              </span>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-body text-ink">Spent</span>
              <span className="text-body-strong text-amber-700 tabular-nums shrink-0">
                −{formatCurrency(spentTotal, currency)}
              </span>
            </li>
            <li className="flex items-center justify-between gap-3 border-t border-ink/10 pt-3">
              <span className="text-body-strong text-ink">Remaining</span>
              <span
                className={`text-body-strong tabular-nums shrink-0 ${
                  remainingTotal >= 0 ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {formatCurrency(remainingTotal, currency)}
              </span>
            </li>
          </ul>
        </div>
      )}

      {shown === "budget" && (
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-full text-center">
            <p className="text-body text-ink-muted-80 text-center">
              {formatCurrency(budgetTotals.totalSpentBudgeted, currency)} of{" "}
              {formatCurrency(budgetTotals.totalLimit, currency)}
            </p>
            <div className="mt-3">
              <ProgressBar
                value={
                  budgetTotals.totalLimit > 0
                    ? budgetTotals.totalSpentBudgeted / budgetTotals.totalLimit
                    : 0
                }
              />
            </div>
          </div>
          <ul className="flex flex-col gap-4 w-full">
            {budgeted.map((cat) => {
              const limit = cat.monthlyBudget ?? 0;
              const spent = budgetSpentByCategory[cat.id] ?? 0;
              const over = spent > limit;
              return (
                <li key={cat.id}>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="flex items-center gap-2 min-w-0">
                      <CategoryGlyph icon={cat.icon} size={18} />
                      <span className="text-body text-ink truncate text-left">{cat.name}</span>
                    </span>
                    <span
                      className={
                        over
                          ? "text-body-strong text-red-600 tabular-nums"
                          : "text-body tabular-nums text-ink-muted-80"
                      }
                    >
                      {formatCurrency(spent, currency)} / {formatCurrency(limit, currency)}
                    </span>
                  </div>
                  <ProgressBar value={limit > 0 ? spent / limit : 0} />
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Sheet>
  );
}
