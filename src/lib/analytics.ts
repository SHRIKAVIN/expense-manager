import type { Category, Expense } from "./types";
import { isoToDate, monthKey } from "./format";

export function sum(expenses: Expense[]): number {
  return expenses.reduce((acc, e) => acc + e.amount, 0);
}

export function filterByMonth(expenses: Expense[], key: string): Expense[] {
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

/** Per-day totals for the current month. */
export function monthlyTrend(expenses: Expense[]): TrendPoint[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  const points: TrendPoint[] = [];
  for (let d = 1; d <= days; d++) {
    const iso = new Date(year, month, d).toISOString().slice(0, 10);
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
    const key = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString(undefined, { month: "short" });
    const total = expenses
      .filter((e) => monthKey(e.date) === key)
      .reduce((a, e) => a + e.amount, 0);
    points.push({ label, total });
  }
  return points;
}

/** Month-over-month comparison: this month vs previous month. */
export function monthOverMonth(expenses: Expense[]): { current: number; previous: number } {
  const now = new Date();
  const cur = now.toISOString().slice(0, 7);
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prev = prevDate.toISOString().slice(0, 7);
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
