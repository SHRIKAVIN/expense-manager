import type { Category, Expense, IncomeEntry } from "./types";
import {
  currentMonthKey,
  isoToDate,
  isOverallPeriod,
  monthKey,
  shiftMonthKey,
} from "./format";

export function sum(expenses: Expense[]): number {
  return expenses.reduce((acc, e) => acc + e.amount, 0);
}

/** Expenses that count toward spent totals, donut, budgets, and insights. */
export function expensesForTotals(expenses: Expense[]): Expense[] {
  return expenses.filter((e) => !e.excludedFromTotals);
}

export function sumIncome(entries: IncomeEntry[], month?: string): number {
  return entries
    .filter((e) => !month || isOverallPeriod(month) || e.month === month)
    .reduce((acc, e) => acc + e.amount, 0);
}

/** Filter by `yyyy-mm`, or return all expenses when `key` is Overall. */
export function filterByMonth(expenses: Expense[], key: string): Expense[] {
  if (isOverallPeriod(key)) return expenses;
  return expenses.filter((e) => monthKey(e.date) === key);
}

export interface CategorySlice {
  categoryId: string;
  name: string;
  icon: string;
  total: number;
}

export function spendByCategory(
  expenses: Expense[],
  categoriesById: Record<string, Category>,
): CategorySlice[] {
  const totals: Record<string, number> = {};
  for (const e of expenses) totals[e.categoryId] = (totals[e.categoryId] ?? 0) + e.amount;
  return Object.entries(totals)
    .map(([categoryId, total]) => {
      const cat = categoriesById[categoryId];
      return {
        categoryId,
        name: cat?.name ?? "Unknown",
        icon: cat?.icon ?? "other",
        total,
      };
    })
    .sort((a, b) => b.total - a.total);
}

export interface TrendPoint {
  label: string;
  total: number;
}

/** Daily totals for the current week (Mon..Sun). */
export function weeklyTrend(expenses: Expense[]): TrendPoint[] {
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // 0 = Monday
  const monday = new Date(now);
  monday.setDate(now.getDate() - day);
  monday.setHours(0, 0, 0, 0);
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return labels.map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const total = expenses.filter((e) => e.date === iso).reduce((a, e) => a + e.amount, 0);
    return { label, total };
  });
}

/** Per-day totals for a month (`yyyy-mm`). Defaults to the current month.
 *  For Overall, returns per-month totals across the available range. */
export function monthlyTrend(expenses: Expense[], month = currentMonthKey()): TrendPoint[] {
  if (isOverallPeriod(month)) return yearlyTrend(expenses);

  const [y, m] = month.split("-").map(Number);
  const year = y;
  const monthIndex = (m ?? 1) - 1;
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const points: TrendPoint[] = [];
  for (let d = 1; d <= days; d++) {
    const iso = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const total = expenses.filter((e) => e.date === iso).reduce((a, e) => a + e.amount, 0);
    points.push({ label: String(d), total });
  }
  return points;
}

/** Per-month totals for the trailing 12 months. */
export function yearlyTrend(expenses: Expense[]): TrendPoint[] {
  const now = new Date();
  const points: TrendPoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString(undefined, { month: "short" });
    const total = expenses
      .filter((e) => monthKey(e.date) === key)
      .reduce((a, e) => a + e.amount, 0);
    points.push({ label, total });
  }
  return points;
}

/** Month-over-month comparison for a given month (`yyyy-mm`) vs the prior month.
 *  Overall falls back to the current calendar month vs previous. */
export function monthOverMonth(
  expenses: Expense[],
  month = currentMonthKey(),
): { current: number; previous: number } {
  const cur = isOverallPeriod(month) ? currentMonthKey() : month;
  const prev = shiftMonthKey(cur, -1);
  return {
    current: sum(filterByMonth(expenses, cur)),
    previous: sum(filterByMonth(expenses, prev)),
  };
}

export function groupByDay(expenses: Expense[]): { date: string; items: Expense[] }[] {
  const groups: Record<string, Expense[]> = {};
  for (const e of expenses) (groups[e.date] ??= []).push(e);
  return Object.entries(groups)
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, items]) => ({
      date,
      items: items.sort((x, y) => isoToDate(y.date).getTime() - isoToDate(x.date).getTime() || y.createdAt - x.createdAt),
    }));
}
