import { useMemo, useState, useEffect } from "react";
import { Screen, ScreenHeader } from "@/layout/Screen";
import { Card } from "@/components/Card";
import { MonthPicker } from "@/components/MonthPicker";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useAppData } from "@/data/AppDataProvider";
import { useAuth } from "@/auth/AuthProvider";
import { useToast } from "@/components/Toast";
import { sumIncome } from "@/lib/analytics";
import { currentMonthKey, formatCurrency, formatDateTime } from "@/lib/format";
import { setIncomeSelectedMonth } from "@/lib/incomeUiState";
import { PlusIcon, TrashIcon } from "@/lib/icons";
import type { IncomeEntry } from "@/lib/types";

export function IncomeScreen() {
  const { user } = useAuth();
  const currency = user?.currency ?? "INR";
  const { income, removeIncome, can } = useAppData();
  const { show } = useToast();

  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);
  const [confirmTarget, setConfirmTarget] = useState<IncomeEntry | null>(null);

  useEffect(() => {
    setIncomeSelectedMonth(selectedMonth);
  }, [selectedMonth]);

  const minMonth = useMemo(() => {
    if (income.length === 0) return undefined;
    return income.reduce(
      (min, e) => (e.month < min ? e.month : min),
      currentMonthKey(),
    );
  }, [income]);

  const monthIncome = useMemo(
    () => income.filter((e) => e.month === selectedMonth),
    [income, selectedMonth],
  );
  const monthTotal = useMemo(() => sumIncome(income, selectedMonth), [income, selectedMonth]);

  const confirmDelete = async () => {
    if (!confirmTarget) return;
    await removeIncome(confirmTarget.id);
    show("Income removed");
    setConfirmTarget(null);
  };

  return (
    <Screen topInset={false} data-testid="income-screen">
      <ScreenHeader title="Income" />

      <div className="mb-4" data-testid="income-month-picker">
        <MonthPicker value={selectedMonth} onChange={setSelectedMonth} minMonth={minMonth} />
      </div>

      <Card className="mb-6" data-testid="income-month-total">
        <p className="text-tagline text-ink-muted-80 mb-1">Total income this month</p>
        <p className="text-display-md text-ink">{formatCurrency(monthTotal, currency)}</p>
      </Card>

      {monthIncome.length === 0 ? (
        <Card data-testid="income-empty">
          <EmptyState
            icon={<PlusIcon size={48} />}
            headline="No income recorded"
            subcopy="Tap the + button to add salary, freelance payments, or other inflows."
          />
        </Card>
      ) : (
        <Card padded={false} className="overflow-hidden" data-testid="income-list">
          {monthIncome.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center gap-3 px-6 py-4 border-b border-divider-soft last:border-b-0"
              data-testid={`income-entry-${entry.id}`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-body-strong text-ink">
                  {entry.label?.trim() || "Income"}
                </p>
                <p className="text-caption text-ink-muted-48">
                  Added {formatDateTime(entry.createdAt)}
                </p>
              </div>
              <span className="text-body-strong text-ink tabular-nums shrink-0">
                +{formatCurrency(entry.amount, currency)}
              </span>
              {can.writeExpenses && (
                <button
                  type="button"
                  aria-label="Delete income"
                  data-testid={`income-delete-${entry.id}`}
                  onClick={() => setConfirmTarget(entry)}
                  className="h-9 w-9 rounded-full flex items-center justify-center text-ink-muted-48 outline-none shrink-0"
                >
                  <TrashIcon size={18} />
                </button>
              )}
            </div>
          ))}
        </Card>
      )}

      <ConfirmDialog
        open={!!confirmTarget}
        title="Remove income?"
        message={
          confirmTarget
            ? `${formatCurrency(confirmTarget.amount, currency)} will be removed from ${selectedMonth}.`
            : undefined
        }
        confirmLabel="Remove"
        onConfirm={confirmDelete}
        onClose={() => setConfirmTarget(null)}
      />
    </Screen>
  );
}
