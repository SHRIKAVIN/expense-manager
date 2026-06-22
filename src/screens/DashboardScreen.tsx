import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Screen } from "@/layout/Screen";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { CountUp } from "@/components/CountUp";
import { ProgressBar } from "@/components/ProgressBar";
import { EmptyState } from "@/components/EmptyState";
import { ExpenseRow } from "@/features/ExpenseRow";
import { ExpenseSheet } from "@/features/ExpenseSheet";
import { CategoryDonut } from "@/features/CategoryDonut";
import { useAppData } from "@/data/AppDataProvider";
import { useAuth } from "@/auth/AuthProvider";
import { useToast } from "@/components/Toast";
import {
  filterByMonth,
  spendByCategory,
  sum,
} from "@/lib/analytics";
import { currentMonthKey, formatCurrency, monthLabel, relativeDue } from "@/lib/format";
import {
  AlertIcon,
  CategoryGlyph,
  ListIcon,
  RepeatIcon,
} from "@/lib/icons";
import type { Expense } from "@/lib/types";
import { listItemVariants } from "@/lib/motion";

export function DashboardScreen() {
  const { user } = useAuth();
  const currency = user?.currency ?? "INR";
  const { expenses, categories, categoriesById, recurring, removeExpense } = useAppData();
  const { show } = useToast();

  const [editing, setEditing] = useState<Expense | null>(null);
  const [dismissedDue, setDismissedDue] = useState<string[]>([]);

  const monthExpenses = useMemo(
    () => filterByMonth(expenses, currentMonthKey()),
    [expenses],
  );
  const totalSpent = useMemo(() => sum(monthExpenses), [monthExpenses]);
  const slices = useMemo(
    () => spendByCategory(monthExpenses, categoriesById),
    [monthExpenses, categoriesById],
  );
  const recent = useMemo(() => expenses.slice(0, 5), [expenses]);

  const budgeted = useMemo(
    () => categories.filter((c) => !c.archived && c.monthlyBudget && c.monthlyBudget > 0),
    [categories],
  );
  const budgetTotals = useMemo(() => {
    const totalLimit = budgeted.reduce((a, c) => a + (c.monthlyBudget ?? 0), 0);
    const totalSpentBudgeted = budgeted.reduce(
      (a, c) => a + sum(monthExpenses.filter((e) => e.categoryId === c.id)),
      0,
    );
    return { totalLimit, totalSpentBudgeted };
  }, [budgeted, monthExpenses]);

  const upcoming = useMemo(() => {
    return recurring
      .filter((r) => !dismissedDue.includes(r.id))
      .filter((r) => {
        const d = (new Date(r.nextDue).getTime() - Date.now()) / 86400000;
        return d <= 5;
      })
      .slice(0, 2);
  }, [recurring, dismissedDue]);

  const handleDelete = async (e: Expense) => {
    await removeExpense(e.id);
    show("Expense deleted");
  };

  const isEmpty = expenses.length === 0;

  return (
    <Screen>
      <p className="text-body text-ink-muted-48">{monthLabel(currentMonthKey())}</p>
      <div className="mb-2">
        <p className="text-tagline text-ink-muted-80 mb-1">Total spent this month</p>
        <CountUp value={totalSpent} currency={currency} className="text-display-lg text-ink" />
      </div>

      {/* Upcoming recurring */}
      <AnimatePresence>
        {upcoming.map((r) => (
          <motion.div
            key={r.id}
            layout
            variants={listItemVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="mt-4"
          >
            <Card className="flex items-center gap-3" padded={false}>
              <div className="flex items-center gap-3 p-4 flex-1 min-w-0">
                <div className="h-10 w-10 rounded-sm bg-canvas-parchment flex items-center justify-center text-primary shrink-0">
                  <RepeatIcon size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-body-strong text-ink truncate">
                    {r.merchant} — {formatCurrency(r.amount, currency)}
                  </p>
                  <p className="text-caption text-ink-muted-48">{relativeDue(r.nextDue)}</p>
                </div>
                <Button
                  variant="secondary"
                  className="px-4 py-2"
                  onClick={() => setDismissedDue((d) => [...d, r.id])}
                >
                  Dismiss
                </Button>
              </div>
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>

      {isEmpty ? (
        <Card className="mt-6">
          <EmptyState
            icon={<ListIcon size={48} />}
            headline="Your workspace is ready"
            subcopy="Add your first expense to see your spending come to life here."
          />
        </Card>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {/* Donut + legend */}
          <Card>
            <p className="text-tagline text-ink mb-4">Spend by category</p>
            <CategoryDonut slices={slices} currency={currency} total={totalSpent} />
            <div className="mt-5 flex flex-col gap-2">
              {slices.slice(0, 5).map((s) => (
                <div key={s.categoryId} className="flex items-center gap-3">
                  <span className="text-ink-muted-80">
                    <CategoryGlyph icon={s.icon} size={18} />
                  </span>
                  <span className="text-body text-ink flex-1 truncate">{s.name}</span>
                  <span className="text-body text-ink-muted-80 tabular-nums">
                    {formatCurrency(s.total, currency)}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Budget health */}
          {budgeted.length > 0 && (
            <Card>
              <div className="flex items-center justify-between mb-3">
                <p className="text-tagline text-ink">Budget health</p>
                {budgetTotals.totalSpentBudgeted > budgetTotals.totalLimit && (
                  <span className="text-ink-muted-48">
                    <AlertIcon size={18} />
                  </span>
                )}
              </div>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-body text-ink-muted-80">
                  {formatCurrency(budgetTotals.totalSpentBudgeted, currency)} of{" "}
                  {formatCurrency(budgetTotals.totalLimit, currency)}
                </span>
              </div>
              <ProgressBar
                value={
                  budgetTotals.totalLimit > 0
                    ? budgetTotals.totalSpentBudgeted / budgetTotals.totalLimit
                    : 0
                }
              />
            </Card>
          )}

          {/* Recent transactions */}
          <Card padded={false}>
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <p className="text-tagline text-ink">Recent</p>
            </div>
            <div>
              {recent.map((e) => (
                <ExpenseRow
                  key={e.id}
                  expense={e}
                  category={categoriesById[e.categoryId]}
                  currency={currency}
                  onEdit={setEditing}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </Card>
        </div>
      )}

      <ExpenseSheet open={!!editing} editing={editing} onClose={() => setEditing(null)} />
    </Screen>
  );
}
