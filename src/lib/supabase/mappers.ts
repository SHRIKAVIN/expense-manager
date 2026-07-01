import type {
  Category,
  Expense,
  Receipt,
  Recurring,
  SessionUser,
  ThemePreference,
} from "@/lib/types";
import type {
  DbCategory,
  DbExpense,
  DbProfile,
  DbReceipt,
  DbRecurring,
} from "@/lib/supabase/database.types";

export function profileToSession(row: DbProfile): SessionUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    currency: row.currency,
    themePreference: row.theme_preference as ThemePreference,
    createdAt: new Date(row.created_at).getTime(),
  };
}

export function toCategory(row: DbCategory): Category {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    icon: row.icon,
    monthlyBudget: row.monthly_budget ?? undefined,
    archived: row.archived,
    createdAt: new Date(row.created_at).getTime(),
  };
}

export function toExpense(row: DbExpense): Expense {
  return {
    id: row.id,
    userId: row.user_id,
    amount: Number(row.amount),
    merchant: row.merchant,
    categoryId: row.category_id,
    date: row.date,
    paymentMethod: row.payment_method ?? undefined,
    notes: row.notes ?? undefined,
    receiptId: row.receipt_id ?? undefined,
    recurringId: row.recurring_id ?? undefined,
    recurringPeriod: row.recurring_period ?? undefined,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

export function toReceipt(row: DbReceipt): Receipt {
  return {
    id: row.id,
    userId: row.user_id,
    dataUrl: row.data_url,
    createdAt: new Date(row.created_at).getTime(),
  };
}

export function toRecurring(row: DbRecurring): Recurring {
  return {
    id: row.id,
    userId: row.user_id,
    amount: Number(row.amount),
    merchant: row.merchant,
    categoryId: row.category_id,
    frequency: row.frequency,
    nextDue: row.next_due,
    paymentMethod: row.payment_method ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: new Date(row.created_at).getTime(),
  };
}
