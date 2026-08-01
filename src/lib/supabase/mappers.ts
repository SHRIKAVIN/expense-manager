import type {
  Category,
  Expense,
  IncomeEntry,
  Receipt,
  ReimbursementRequest,
  Recurring,
  SessionUser,
  Settlement,
  ThemePreference,
} from "@/lib/types";
import type {
  DbCategory,
  DbExpense,
  DbIncomeEntry,
  DbProfile,
  DbReimbursementRequest,
  DbReceipt,
  DbRecurring,
  DbSettlement,
} from "@/lib/supabase/database.types";

export function profileToSession(row: DbProfile): SessionUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    currency: row.currency,
    themePreference: row.theme_preference as ThemePreference,
    gender: row.gender === "male" || row.gender === "female" ? row.gender : undefined,
    upiId: row.upi_id?.trim() || undefined,
    phone: row.phone?.trim() || undefined,
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
    excludedFromTotals: row.excluded_from_totals ?? false,
    reimbursementRequestId: row.reimbursement_request_id ?? undefined,
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

export function toIncome(row: DbIncomeEntry): IncomeEntry {
  return {
    id: row.id,
    userId: row.user_id,
    amount: Number(row.amount),
    month: row.month,
    label: row.label ?? undefined,
    createdAt: new Date(row.created_at).getTime(),
  };
}

export function toReimbursement(row: DbReimbursementRequest): ReimbursementRequest {
  return {
    id: row.id,
    expenseId: row.expense_id,
    requesterId: row.requester_id,
    requesterName: row.requester_name,
    payerEmail: row.payer_email,
    payerName: row.payer_name,
    amount: Number(row.amount),
    merchant: row.merchant,
    status: row.status,
    createdAt: new Date(row.created_at).getTime(),
    completedAt: row.completed_at ? new Date(row.completed_at).getTime() : undefined,
    payerExpenseId: row.payer_expense_id ?? undefined,
  };
}

export function toSettlement(row: DbSettlement): Settlement {
  return {
    id: row.id,
    reimbursementRequestId: row.reimbursement_request_id,
    payerId: row.payer_id,
    payeeId: row.payee_id,
    amount: Number(row.amount),
    method: row.method,
    note: row.note ?? undefined,
    status: row.status,
    createdAt: new Date(row.created_at).getTime(),
    settledAt: row.settled_at ? new Date(row.settled_at).getTime() : undefined,
    payerName: row.payer_name || undefined,
    payeeName: row.payee_name || undefined,
    merchant: row.merchant ?? undefined,
  };
}
