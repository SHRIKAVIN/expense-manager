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
import { ExpenseDetailSheet } from "@/features/ExpenseDetailSheet";
import { RecurringDetailSheet } from "@/features/RecurringDetailSheet";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SuccessOverlay } from "@/components/SuccessOverlay";
import { MonthPicker } from "@/components/MonthPicker";
import { CategoryDonut } from "@/features/CategoryDonut";
import { ReimbursementsOwedCard } from "@/features/ReimbursementsOwedCard";
import { ReimbursementsConfirmCard } from "@/features/ReimbursementsConfirmCard";
import { ReimbursementsCollectCard } from "@/features/ReimbursementsCollectCard";
import {
  DashboardSummarySheet,
  type DashboardSummaryKind,
} from "@/features/DashboardSummarySheet";
import { useAppData } from "@/data/AppDataProvider";
import { useAuth } from "@/auth/AuthProvider";
import { useToast } from "@/components/Toast";
import {
  filterByMonth,
  spendByCategory,
  sum,
  sumIncome,
} from "@/lib/analytics";
import { currentMonthKey, formatCurrency, listMonthKeys, monthLabel, relativeDue, shiftMonthKey, isOverallPeriod } from "@/lib/format";
import {
  AlertIcon,
  ListIcon,
  RefreshIcon,
  RepeatIcon,
} from "@/lib/icons";
import type { Expense, Recurring } from "@/lib/types";
import { listItemVariants } from "@/lib/motion";

export function DashboardScreen() {
  const { user } = useAuth();
  const currency = user?.currency ?? "INR";
  const { expenses, expensesForTotals, income, categories, categoriesById, recurring, removeExpense, refresh, logRecurring } =
    useAppData();
  const { show } = useToast();

  const [editing, setEditing] = useState<Expense | null>(null);
  const [viewing, setViewing] = useState<Expense | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Expense | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<{
    amountLabel: string;
    detail?: string;
  } | null>(null);
  const [dismissedDue, setDismissedDue] = useState<string[]>([]);
  const [viewingRecurring, setViewingRecurring] = useState<Recurring | null>(null);
  const [loggingRecurringId, setLoggingRecurringId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);
  const [refreshing, setRefreshing] = useState(false);
  const [summaryKind, setSummaryKind] = useState<DashboardSummaryKind | null>(null);

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
    if (isOverallPeriod(selectedMonth)) return;
    if (!availableMonths.includes(selectedMonth)) {
      setSelectedMonth(availableMonths[0] ?? currentMonthKey());
    }
  }, [availableMonths, selectedMonth]);

  const monthExpenses = useMemo(
    () => filterByMonth(expenses, selectedMonth),
    [expenses, selectedMonth],
  );
  const monthExpensesForTotals = useMemo(
    () => filterByMonth(expensesForTotals, selectedMonth),
    [expensesForTotals, selectedMonth],
  );
  const totalSpent = useMemo(() => sum(monthExpensesForTotals), [monthExpensesForTotals]);
  const monthIncomeTotal = useMemo(() => sumIncome(income, selectedMonth), [income, selectedMonth]);
  const netRemaining = monthIncomeTotal - totalSpent;
  const slices = useMemo(
    () => spendByCategory(monthExpensesForTotals, categoriesById),
    [monthExpensesForTotals, categoriesById],
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
  const budgetSpentByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of budgeted) {
      map[c.id] = sum(monthExpensesForTotals.filter((e) => e.categoryId === c.id));
    }
    return map;
  }, [budgeted, monthExpensesForTotals]);

  const monthIncomeEntries = useMemo(
    () =>
      isOverallPeriod(selectedMonth)
        ? [...income].sort((a, b) => b.month.localeCompare(a.month) || b.createdAt - a.createdAt)
        : income.filter((e) => e.month === selectedMonth),
    [income, selectedMonth],
  );

  const budgetTotals = useMemo(() => {
    const totalLimit = budgeted.reduce((a, c) => a + (c.monthlyBudget ?? 0), 0);
    const totalSpentBudgeted = budgeted.reduce(
      (a, c) => a + (budgetSpentByCategory[c.id] ?? 0),
      0,
    );
    return { totalLimit, totalSpentBudgeted };
  }, [budgeted, budgetSpentByCategory]);

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
    const target = confirmTarget;
    await removeExpense(target.id);
    setConfirmTarget(null);
    setDeleteSuccess({
      amountLabel: formatCurrency(target.amount, currency),
      detail: target.merchant,
    });
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
        <SummaryStatCard
          label="Income"
          data-testid="dashboard-summary-income"
          onPress={() => setSummaryKind("income")}
        >
          <CountUp
            value={monthIncomeTotal}
            currency={currency}
            className="text-primary"
          />
        </SummaryStatCard>
        <SummaryStatCard
          label="Spent"
          data-testid="dashboard-summary-spent"
          onPress={() => setSummaryKind("spent")}
        >
          <CountUp value={totalSpent} currency={currency} className="text-amber-700" />
        </SummaryStatCard>
        <SummaryStatCard
          label="Remaining"
          data-testid="dashboard-summary-remaining"
          onPress={() => setSummaryKind("remaining")}
        >
          <CountUp
            value={netRemaining}
            currency={currency}
            className={netRemaining >= 0 ? "text-emerald-600" : "text-red-600"}
          />
        </SummaryStatCard>
      </div>

      <ReimbursementsOwedCard currency={currency} />
      <ReimbursementsCollectCard currency={currency} />
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
            <Card
              className="flex items-center gap-3"
              padded={false}
              onPress={() => setViewingRecurring(r)}
            >
              <div className="flex items-center gap-3 p-4 flex-1 min-w-0">
                <div className="h-10 w-10 rounded-sm bg-canvas-parchment flex items-center justify-center text-primary shrink-0">
                  <RepeatIcon size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-body-strong text-ink flex items-baseline gap-1 min-w-0">
                    <span className="truncate">{r.merchant}</span>
                    <span className="shrink-0">— {formatCurrency(r.amount, currency)}</span>
                  </p>
                  <p className="text-caption text-ink-muted-48">{relativeDue(r.nextDue)}</p>
                </div>
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
            <CategoryDonut
              slices={slices}
              expenses={monthExpensesForTotals}
              currency={currency}
              total={totalSpent}
              monthLabel={monthLabel(selectedMonth)}
            />
          </Card>

          {/* Budget health — monthly budgets only make sense for a single month */}
          {budgeted.length > 0 && !isOverallPeriod(selectedMonth) && (
            <Card data-testid="dashboard-budget" onPress={() => setSummaryKind("budget")}>
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
                  onOpen={setViewing}
                  onEdit={setEditing}
                  onDelete={(exp) => setConfirmTarget(exp)}
                  deletePending={confirmTarget?.id === e.id}
                  showDate
                />
              ))}
            </div>
          </Card>
        </div>
      )}

      <ExpenseDetailSheet
        expense={viewing}
        category={viewing ? categoriesById[viewing.categoryId] : undefined}
        currency={currency}
        onClose={() => setViewing(null)}
        onEdit={setEditing}
      />
      <ExpenseSheet open={!!editing} editing={editing} onClose={() => setEditing(null)} />
      <RecurringDetailSheet
        recurring={viewingRecurring}
        category={
          viewingRecurring ? categoriesById[viewingRecurring.categoryId] : undefined
        }
        currency={currency}
        logging={loggingRecurringId === viewingRecurring?.id}
        onLog={
          viewingRecurring
            ? () => {
                const id = viewingRecurring.id;
                void (async () => {
                  setLoggingRecurringId(id);
                  try {
                    await logRecurring(id);
                    show(`Logged ${viewingRecurring.merchant}`);
                    setViewingRecurring(null);
                  } catch (err) {
                    show(err instanceof Error ? err.message : "Could not log expense");
                  } finally {
                    setLoggingRecurringId(null);
                  }
                })();
              }
            : undefined
        }
        onDismiss={
          viewingRecurring
            ? () => {
                setDismissedDue((d) => [...d, viewingRecurring.id]);
                setViewingRecurring(null);
              }
            : undefined
        }
        onClose={() => setViewingRecurring(null)}
      />
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
      <SuccessOverlay
        open={!!deleteSuccess}
        variant="deleted"
        amountLabel={deleteSuccess?.amountLabel ?? ""}
        detail={deleteSuccess?.detail}
        onClose={() => setDeleteSuccess(null)}
      />
      <DashboardSummarySheet
        kind={summaryKind}
        onClose={() => setSummaryKind(null)}
        monthLabel={monthLabel(selectedMonth)}
        currency={currency}
        incomeEntries={monthIncomeEntries}
        incomeTotal={monthIncomeTotal}
        spentTotal={totalSpent}
        expenseCount={monthExpensesForTotals.length}
        slices={slices}
        remainingTotal={netRemaining}
        budgeted={budgeted}
        budgetSpentByCategory={budgetSpentByCategory}
        budgetTotals={budgetTotals}
      />
    </Screen>
  );
}
