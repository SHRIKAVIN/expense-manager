import { Sheet } from "@/components/Sheet";
import { ProgressBar } from "@/components/ProgressBar";
import { CategoryGlyph } from "@/lib/icons";
import { formatCurrency } from "@/lib/format";
import type { Category, IncomeEntry } from "@/lib/types";
import type { CategorySlice } from "@/lib/analytics";

export type DashboardSummaryKind = "income" | "spent" | "budget";

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
  budgeted = [],
  budgetSpentByCategory = {},
  budgetTotals = { totalLimit: 0, totalSpentBudgeted: 0 },
}: DashboardSummarySheetProps) {
  const open = kind !== null;

  const title =
    kind === "income"
      ? `Income · ${monthLabel}`
      : kind === "spent"
        ? `Spent · ${monthLabel}`
        : kind === "budget"
          ? `Budget health · ${monthLabel}`
          : "";

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {kind === "income" && (
        <div className="flex flex-col gap-4">
          <p className="text-display-md text-primary tabular-nums">
            {formatCurrency(incomeTotal, currency)}
          </p>
          {incomeEntries.length === 0 ? (
            <p className="text-body text-ink-muted-48">No income recorded this month.</p>
          ) : (
            <ul className="flex flex-col gap-3">
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

      {kind === "spent" && (
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-display-md text-amber-700 tabular-nums">
              {formatCurrency(spentTotal, currency)}
            </p>
            <p className="text-caption text-ink-muted-48 mt-1">
              {expenseCount} transaction{expenseCount === 1 ? "" : "s"}
            </p>
          </div>
          {slices.length === 0 ? (
            <p className="text-body text-ink-muted-48">No spending this month.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {slices.map((s) => (
                <li key={s.categoryId} className="flex items-center gap-3">
                  <span className="text-ink-muted-80 shrink-0">
                    <CategoryGlyph icon={s.icon} size={18} />
                  </span>
                  <span className="text-body text-ink flex-1 truncate">{s.name}</span>
                  <span className="text-body-strong text-red-600 tabular-nums shrink-0">
                    {formatCurrency(s.total, currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {kind === "budget" && (
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-body text-ink-muted-80">
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
          <ul className="flex flex-col gap-4">
            {budgeted.map((cat) => {
              const limit = cat.monthlyBudget ?? 0;
              const spent = budgetSpentByCategory[cat.id] ?? 0;
              const over = spent > limit;
              return (
                <li key={cat.id}>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="flex items-center gap-2 min-w-0">
                      <CategoryGlyph icon={cat.icon} size={18} />
                      <span className="text-body text-ink truncate">{cat.name}</span>
                    </span>
                    <span
                      className={
                        over ? "text-body-strong text-red-600 tabular-nums" : "text-body tabular-nums text-ink-muted-80"
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
