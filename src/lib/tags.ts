/** Expense tags: normalized slugs like `trip`, `rent` (UI shows `#trip`). */

const TAG_RE = /^[a-z0-9][a-z0-9_-]{0,23}$/;
const MAX_TAGS = 8;

/** Lowercase, strip `#`, allow letters/digits/_/-. Empty if invalid. */
export function normalizeTag(raw: string): string | null {
  const t = raw.trim().replace(/^#+/, "").toLowerCase();
  if (!t || !TAG_RE.test(t)) return null;
  return t;
}

/** Parse a freeform tags field (`#trip rent, food`) into unique normalized tags. */
export function parseTagsInput(raw: string): string[] {
  const parts = raw.split(/[\s,]+/).filter(Boolean);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const tag = normalizeTag(part);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

export function formatTagsInput(tags: string[] | undefined): string {
  if (!tags?.length) return "";
  return tags.map((t) => `#${t}`).join(" ");
}

export function formatTagLabel(tag: string): string {
  return tag.startsWith("#") ? tag : `#${tag}`;
}

/** Popular tags across expenses, most used first. */
export function collectPopularTags(
  expenses: Array<{ tags?: string[] }>,
  limit = 12,
): string[] {
  const freq = new Map<string, number>();
  for (const e of expenses) {
    for (const t of e.tags ?? []) {
      freq.set(t, (freq.get(t) ?? 0) + 1);
    }
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([t]) => t);
}

export type ExpenseSearchFields = {
  amount: number;
  merchant: string;
  notes?: string;
  paymentMethod?: string;
  tags?: string[];
  categoryName?: string;
};

/**
 * Match merchant, notes, payment method, category, tags, and amount.
 * A query starting with `#` prefers tag match (still allows other fields).
 */
export function expenseMatchesQuery(expense: ExpenseSearchFields, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;

  const tagQuery = q.startsWith("#") ? normalizeTag(q) : null;
  if (tagQuery) {
    return (expense.tags ?? []).some((t) => t.includes(tagQuery) || tagQuery.includes(t));
  }

  if (expense.merchant.toLowerCase().includes(q)) return true;
  if ((expense.notes ?? "").toLowerCase().includes(q)) return true;
  if ((expense.paymentMethod ?? "").toLowerCase().includes(q)) return true;
  if ((expense.categoryName ?? "").toLowerCase().includes(q)) return true;
  if ((expense.tags ?? []).some((t) => t.includes(q) || `#${t}`.includes(q))) return true;

  const amountStr = String(expense.amount);
  const amountFixed = expense.amount.toFixed(2);
  if (amountStr.includes(q) || amountFixed.includes(q)) return true;

  return false;
}

export function expenseHasTag(expense: { tags?: string[] }, tag: string): boolean {
  const t = normalizeTag(tag);
  if (!t) return false;
  return (expense.tags ?? []).includes(t);
}
