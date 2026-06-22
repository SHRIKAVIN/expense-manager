import { useMemo, useState } from "react";
import { Screen, ScreenHeader } from "@/layout/Screen";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { ProgressBar } from "@/components/ProgressBar";
import { EmptyState } from "@/components/EmptyState";
import { Sheet } from "@/components/Sheet";
import { useAppData } from "@/data/AppDataProvider";
import { useAuth } from "@/auth/AuthProvider";
import { useToast } from "@/components/Toast";
import { filterByMonth, sum } from "@/lib/analytics";
import { currentMonthKey, formatCurrency } from "@/lib/format";
import { AlertIcon, CategoryGlyph, WalletIcon } from "@/lib/icons";
import type { Category } from "@/lib/types";

export function BudgetsScreen() {
  const { user } = useAuth();
  const currency = user?.currency ?? "INR";
  const { categories, expenses, can, editCategory } = useAppData();
  const { show } = useToast();

  const [editing, setEditing] = useState<Category | null>(null);
  const [limitText, setLimitText] = useState("");

  const monthExpenses = useMemo(() => filterByMonth(expenses, currentMonthKey()), [expenses]);
  const active = categories.filter((c) => !c.archived);
  const withBudget = active.filter((c) => c.monthlyBudget && c.monthlyBudget > 0);
  const withoutBudget = active.filter((c) => !c.monthlyBudget || c.monthlyBudget <= 0);

  const spentFor = (catId: string) =>
    sum(monthExpenses.filter((e) => e.categoryId === catId));

  const openEdit = (c: Category) => {
    setEditing(c);
    setLimitText(c.monthlyBudget ? String(c.monthlyBudget) : "");
  };

  const saveLimit = async () => {
    if (!editing) return;
    const v = Number(limitText);
    try {
      await editCategory(editing.id, { monthlyBudget: Number.isNaN(v) ? 0 : v });
      show("Budget updated");
      setEditing(null);
    } catch (err) {
      show(err instanceof Error ? err.message : "Could not update budget");
    }
  };

  return (
    <Screen topInset={false}>
      <ScreenHeader title="Budgets" subtitle="Resets monthly" />

      {withBudget.length === 0 && !can.manageConfig ? (
        <Card>
          <EmptyState
            icon={<WalletIcon size={48} />}
            headline="No budgets set"
            subcopy="An Owner can set monthly budgets for each category."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {withBudget.map((c) => {
            const spent = spentFor(c.id);
            const limit = c.monthlyBudget ?? 0;
            const ratio = limit > 0 ? spent / limit : 0;
            const over = spent > limit;
            return (
              <Card key={c.id}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-sm bg-canvas-parchment flex items-center justify-center text-ink shrink-0">
                    <CategoryGlyph icon={c.icon} size={20} />
                  </div>
                  <span className="text-body-strong text-ink flex-1">{c.name}</span>
                  {over && (
                    <span className="text-ink-muted-48" title="Over budget">
                      <AlertIcon size={20} />
                    </span>
                  )}
                  {can.manageConfig && (
                    <Button variant="secondary" className="px-4 py-1.5" onClick={() => openEdit(c)}>
                      Edit
                    </Button>
                  )}
                </div>
                <div className="flex items-baseline justify-between mb-2">
                  <span className={over ? "text-body-strong text-ink" : "text-body text-ink-muted-80"}>
                    {formatCurrency(spent, currency)}
                  </span>
                  <span className="text-body text-ink-muted-48">
                    of {formatCurrency(limit, currency)}
                  </span>
                </div>
                <ProgressBar value={ratio} />
                {over && (
                  <p className="text-caption text-ink-muted-48 mt-2">
                    Over by {formatCurrency(spent - limit, currency)}
                  </p>
                )}
              </Card>
            );
          })}

          {can.manageConfig && withoutBudget.length > 0 && (
            <div>
              <p className="text-caption-strong text-ink-muted-48 uppercase tracking-wide mb-2 px-1">
                No budget yet
              </p>
              <Card padded={false} className="overflow-hidden">
                {withoutBudget.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => openEdit(c)}
                    className="w-full flex items-center gap-3 px-5 py-4 border-b border-divider-soft last:border-b-0 outline-none text-left"
                  >
                    <div className="h-9 w-9 rounded-sm bg-canvas-parchment flex items-center justify-center text-ink shrink-0">
                      <CategoryGlyph icon={c.icon} size={18} />
                    </div>
                    <span className="text-body text-ink flex-1">{c.name}</span>
                    <span className="text-body text-primary">Set budget</span>
                  </button>
                ))}
              </Card>
            </div>
          )}
        </div>
      )}

      <Sheet
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Budget · ${editing.name}` : "Budget"}
        footer={
          <Button variant="primary" fullWidth onClick={saveLimit}>
            Save budget
          </Button>
        }
      >
        <TextField
          label="Monthly limit"
          inputMode="decimal"
          placeholder="0.00"
          value={limitText}
          onChange={(e) => setLimitText(e.target.value)}
          autoFocus
        />
        <p className="text-caption text-ink-muted-48 mt-3">
          Set to 0 to remove the budget for this category.
        </p>
      </Sheet>
    </Screen>
  );
}
