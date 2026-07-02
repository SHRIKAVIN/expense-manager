import { currentMonthKey } from "@/lib/format";

/** Shared month selection between IncomeScreen and the shell FAB (no provider needed). */
let selectedMonth = currentMonthKey();

export function getIncomeSelectedMonth(): string {
  return selectedMonth;
}

export function setIncomeSelectedMonth(month: string): void {
  selectedMonth = month;
}
