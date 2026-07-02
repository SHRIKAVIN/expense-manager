import { useMemo, useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Screen } from "@/layout/Screen";
import { Card } from "@/components/Card";
import { SummaryStatCard } from "@/components/SummaryStatCard";
import { Button } from "@/components/Button";
import { CountUp } from "@/components/CountUp";
import { ProgressBar } from "@/components/ProgressBar";
import { EmptyState } from "@/components/EmptyState";
import { ExpenseRow } from "@/features/ExpenseRow";
import { ExpenseSheet } from "@/features/ExpenseSheet";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MonthPicker } from "@/components/MonthPicker";
import { CategoryDonut, categorySliceStyle } from "@/features/CategoryDonut";
import { ReimbursementsOwedCard } from "@/features/ReimbursementsOwedCard";
import { ReimbursementsConfirmCard } from "@/features/ReimbursementsConfirmCard";
import { useAppData } from "@/data/AppDataProvider";
import { useAuth } from "@/auth/AuthProvider";
import { useToast } from "@/components/Toast";
import {
  filterByMonth,
  spendByCategory,
  sum,
  sumIncome,
} from "@/lib/analytics";
import { currentMonthKey, formatCurrency, listMonthKeys, monthLabel, relativeDue, shiftMonthKey } from "@/lib/format";
import {
  AlertIcon,
  CategoryGlyph,
  ListIcon,
  RefreshIcon,
  RepeatIcon,
} from "@/lib/icons";
import type { Expense } from "@/lib/types";
import { listItemVariants } from "@/lib/motion";

export function DashboardScreen() {
  const { user } = useAuth();
  const currency = user?.currency ?? "INR";
  const { expenses, income, categories, categoriesById, recurring, removeExpense, refresh } = useAppData();
  const { show } = useToast();

  const [editing, setEditing] = useState<Expense | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Expense | null>(null);
  const [dismissedDue, setDismissedDue] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);
  const [refreshing, setRefreshing] = useState(false);

  const minMonth = useMemo(() => {
    if (expenses.length === 0) return undefined;
    return expenses.reduce(
      (min, e) => (e.date.slice(0, 7) < min ? e.date.slice(0, 7) : min),
      currentMonthKey(),
    );
  }, [expenses]);

  const availableMonths = useMemo(() => {
    const to = currentMonthKey();
    const from = minMonth ?? shiftMonthKey(to, -23);
    return listMonthKeys(from, to);
  }, [minMonth]);

  useEffect(() => {
    if (!availableMonths.includes(selectedMonth)) {
      setSelectedMonth(availableMonths[availableMonths.length - 1] ?? currentMonthKey());
    }
  }, [availableMonths, selectedMonth]);

  useEffect(() => {
    if (expenses.length === 0) return;
    const hasInMonth = expenses.some((e) => e.date.slice(0, 7) === selectedMonth);
    if (!hasInMonth) {
      const latest = expenses.reduce(
        (max, e) => (e.date.slice(0, 7) > max ? e.date.slice(0, 7) : max),
        expenses[0].date.slice(0, 7),
      );
      setSelectedMonth(latest);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-sync when expenses change
  }, [expenses]);

  const monthExpenses = useMemo(
    () => filterByMonth(expenses, selectedMonth),
    [expenses, selectedMonth],
  );
  const totalSpent = useMemo(() => sum(monthExpenses), [monthExpenses]);
  const monthIncomeTotal = useMemo(() => sumIncome(income, selectedMonth), [income, selectedMonth]);
  const netRemaining = monthIncomeTotal - totalSpent;
  const slices = useMemo(
    () => spendByCategory(monthExpenses, categoriesById),
    [monthExpenses, categoriesById],
  );
  const recent = useMemo(
    () =>
      [...monthExpenses]
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
        .slice(0, 5),
    [monthExpenses],
  );

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

  const confirmDelete = async () => {
    if (!confirmTarget) return;
    await removeExpense(confirmTarget.id);
    show("Expense deleted");
    setConfirmTarget(null);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } catch (err) {
      show(err instanceof Error ? err.message : "Could not refresh");
    } finally {
      setRefreshing(false);
    }
  };

  const isEmpty = expenses.length === 0;
  const monthEmpty = !isEmpty && monthExpenses.length === 0;

  return (
    <Screen data-testid="dashboard-screen">
      <div className="mb-4 flex items-center justify-between gap-3" data-testid="dashboard-toolbar">
        <MonthPicker
          value={selectedMonth}
          onChange={setSelectedMonth}
          minMonth={minMonth}
          data-testid="dashboard-month-picker"
        />
        <Button
          variant="icon-circular"
          aria-label="Refresh dashboard"
          data-testid="dashboard-refresh"
          disabled={refreshing}
          onClick={() => void handleRefresh()}
          className={refreshing ? "shrink-0 [&_svg]:animate-spin" : "shrink-0"}
        >
          <RefreshIcon size={20} />
        </Button>
      </div>
      <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-3" data-testid="dashboard-summary">
        <SummaryStatCard label="Income" data-testid="dashboard-summary-income">
          <CountUp
            value={monthIncomeTotal}
            currency={currency}
            className="text-primary"
          />
        </SummaryStatCard>
        <SummaryStatCard label="Spent" data-testid="dashboard-summary-spent">
          <CountUp value={totalSpent} currency={currency} className="text-amber-700" />
        </SummaryStatCard>
        <SummaryStatCard label="Remaining" data-testid="dashboard-summary-remaining">
          <CountUp
            value={netRemaining}
            currency={currency}
            className={netRemaining >= 0 ? "text-emerald-600" : "text-red-600"}
          />
        </SummaryStatCard>
      </div>

      <ReimbursementsOwedCard currency={currency} />
      <ReimbursementsConfirmCard currency={currency} />

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
      ) : monthEmpty ? (
        <Card className="mt-6">
          <EmptyState
            icon={<ListIcon size={48} />}
            headline="No spending this month"
            subcopy={`Nothing recorded in ${monthLabel(selectedMonth)}.`}
          />
        </Card>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {/* Donut + legend */}
          <Card data-testid="dashboard-donut">
            <p className="text-tagline text-ink mb-4">Spend by category</p>
            <CategoryDonut slices={slices} currency={currency} total={totalSpent} />
            <div className="mt-5 flex flex-col gap-2">
              {slices.slice(0, 5).map((s, i) => (
                <div key={s.categoryId} className="flex items-center gap-3">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary-focus"
                    style={categorySliceStyle(i, slices.length)}
                    aria-hidden
                  />
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
            <Card data-testid="dashboard-budget">
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
          <Card padded={false} className="overflow-hidden" data-testid="dashboard-recent">
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
                  onDelete={(e) => setConfirmTarget(e)}
                  showDate
                />
              ))}
            </div>
          </Card>
        </div>
      )}

      <ExpenseSheet open={!!editing} editing={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={!!confirmTarget}
        title="Delete expense?"
        message={
          confirmTarget
            ? `"${confirmTarget.merchant}" will be permanently removed.`
            : undefined
        }
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onClose={() => setConfirmTarget(null)}
      />
    </Screen>
  );
}
