export function formatCurrency(amount: number, currency = "INR"): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)}`;
  }
}

/** Signed formatting: expenses are negative outflows, prefixed with a sign per §1.1. */
export function formatSignedCurrency(amount: number, currency = "INR"): string {
  const sign = amount < 0 ? "-" : "+";
  return `${sign}${formatCurrency(Math.abs(amount), currency)}`;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isoToDate(iso: string): Date {
  // Treat as local date.
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function formatDate(iso: string): string {
  const date = isoToDate(iso);
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDayHeading(iso: string): string {
  const date = isoToDate(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (same(date, today)) return "Today";
  if (same(date, yest)) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7); // yyyy-mm
}

export function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Shift a yyyy-mm key by `delta` months (negative = past). */
export function shiftMonthKey(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, (m ?? 1) - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Inclusive list of yyyy-mm keys from `from` through `to`, newest first. */
export function listMonthKeys(from: string, to: string): string[] {
  const keys: string[] = [];
  let cur = to;
  for (;;) {
    keys.push(cur);
    if (cur === from) break;
    cur = shiftMonthKey(cur, -1);
  }
  return keys;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export function daysUntil(iso: string): number {
  const target = isoToDate(iso);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86400000);
}

export function relativeDue(iso: string): string {
  const d = daysUntil(iso);
  if (d < 0) return `overdue by ${Math.abs(d)}d`;
  if (d === 0) return "due today";
  if (d === 1) return "due tomorrow";
  return `due in ${d} days`;
}
