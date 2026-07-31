import type { RecurringFrequency } from "@/lib/types";

/** Advance an ISO date (yyyy-mm-dd) by the recurring frequency. */
export function advanceRecurringDate(iso: string, frequency: RecurringFrequency): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (frequency === "weekly") date.setDate(date.getDate() + 7);
  else if (frequency === "monthly") date.setMonth(date.getMonth() + 1);
  else date.setFullYear(date.getFullYear() + 1);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
