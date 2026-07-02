import { useEffect } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { isQuickSwitchEmail } from "@/auth/quickSwitch";
import { useAppData } from "@/data/AppDataProvider";
import { filterByMonth, sum } from "@/lib/analytics";
import { currentMonthKey, formatCurrency } from "@/lib/format";
import { notify } from "@/lib/notifications";
import { notifyPartnerBudgetAlert, partnerAlertsEnabled } from "@/lib/partnerNotify";

const FULL_RATIO = 0.9;

/** Alerts quick-switch users when a category budget is nearly full or exceeded. */
export function BudgetAlerts() {
  const { user } = useAuth();
  const { categories, expensesForTotals } = useAppData();

  useEffect(() => {
    if (!user || !isQuickSwitchEmail(user.email)) return;

    const month = currentMonthKey();
    const monthExpenses = filterByMonth(expensesForTotals, month);
    const firedKey = `em.budgetAlerts.fired.${user.id}`;
    const fired: string[] = JSON.parse(localStorage.getItem(firedKey) || "[]");
    const next = [...fired];

    for (const cat of categories) {
      if (cat.archived || !cat.monthlyBudget || cat.monthlyBudget <= 0) continue;

      const spent = sum(monthExpenses.filter((e) => e.categoryId === cat.id));
      const limit = cat.monthlyBudget;
      const ratio = spent / limit;

      if (ratio >= 1) {
        const token = `${cat.id}:${month}:exceeded`;
        if (fired.includes(token)) continue;
        notify(
          "Budget exceeded",
          `${cat.name} — ${formatCurrency(spent, user.currency)} of ${formatCurrency(limit, user.currency)}`,
        );
        if (partnerAlertsEnabled(user.id)) {
          void notifyPartnerBudgetAlert(user, cat.name, spent, limit, "exceeded");
        }
        next.push(token);
        continue;
      }

      if (ratio >= FULL_RATIO) {
        const token = `${cat.id}:${month}:full`;
        if (fired.includes(token)) continue;
        notify(
          "Budget almost full",
          `${cat.name} — ${formatCurrency(spent, user.currency)} of ${formatCurrency(limit, user.currency)}`,
        );
        if (partnerAlertsEnabled(user.id)) {
          void notifyPartnerBudgetAlert(user, cat.name, spent, limit, "full");
        }
        next.push(token);
      }
    }

    if (next.length !== fired.length) {
      localStorage.setItem(firedKey, JSON.stringify(next.slice(-80)));
    }
  }, [user, categories, expensesForTotals]);

  return null;
}
