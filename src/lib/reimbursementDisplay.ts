import type { Expense } from "./types";

export type ReimbursementLogTag = "received" | "paid";

/** Green tag on requester logs after reimbursement is confirmed. */
export function reimbursementLogTag(expense: Expense): ReimbursementLogTag | null {
  if (expense.excludedFromTotals) return "received";
  if (expense.reimbursementRequestId || expense.notes?.includes("Reimbursed from")) {
    return "paid";
  }
  return null;
}

export function isReimbursementLogEntry(expense: Expense): boolean {
  return reimbursementLogTag(expense) !== null;
}
