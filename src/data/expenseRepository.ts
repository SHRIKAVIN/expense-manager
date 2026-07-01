import type {
  Category,
  Expense,
  ExpenseInput,
  Receipt,
  Recurring,
  RecurringFrequency,
  Role,
  SessionUser,
} from "@/lib/types";
import { isSupabaseEnabled } from "@/lib/supabase/client";
import { createLocalRepository } from "./localExpenseRepository";
import { createSupabaseRepository } from "./supabaseExpenseRepository";

export class RepositoryError extends Error {
  code: "forbidden" | "not_found" | "validation";
  constructor(code: RepositoryError["code"], message: string) {
    super(message);
    this.name = "RepositoryError";
    this.code = code;
  }
}

export const RolePolicy = {
  canWriteExpenses: (role: Role) => role === "Owner" || role === "Member",
  canManageConfig: (role: Role) => role === "Owner",
  canManageRecurring: (role: Role) => role === "Owner" || role === "Member",
  canExportData: (role: Role) => role === "Owner",
};

export interface ExpenseFilters {
  search?: string;
  categoryId?: string;
  month?: string;
}

export interface ExpenseRepository {
  ensureWorkspace(): Promise<void>;
  listCategories(includeArchived?: boolean): Promise<Category[]>;
  createCategory(input: { name: string; icon: string; monthlyBudget?: number }): Promise<Category>;
  updateCategory(
    id: string,
    patch: Partial<Pick<Category, "name" | "icon" | "monthlyBudget" | "archived">>,
  ): Promise<Category>;
  deleteCategory(id: string): Promise<void>;
  listExpenses(filters?: ExpenseFilters): Promise<Expense[]>;
  getExpense(id: string): Promise<Expense | undefined>;
  createExpense(input: ExpenseInput): Promise<Expense>;
  updateExpense(id: string, patch: Partial<ExpenseInput>): Promise<Expense>;
  deleteExpense(id: string): Promise<void>;
  saveReceipt(dataUrl: string): Promise<Receipt>;
  getReceipt(id: string): Promise<Receipt | undefined>;
  listRecurring(): Promise<Recurring[]>;
  createRecurring(input: {
    amount: number;
    merchant: string;
    categoryId: string;
    frequency: RecurringFrequency;
    nextDue: string;
    paymentMethod?: string;
    notes?: string;
  }): Promise<Recurring>;
  updateRecurring(id: string, patch: Partial<Recurring>): Promise<Recurring>;
  deleteRecurring(id: string): Promise<void>;
  generateDueRecurring(): Promise<Expense[]>;
  exportAll(): Promise<string>;
  wipeUserData(): Promise<void>;
}

/** Cloud (Supabase) when configured, otherwise local IndexedDB. */
export function createRepository(user: SessionUser): ExpenseRepository {
  if (isSupabaseEnabled()) {
    return createSupabaseRepository(user);
  }
  return createLocalRepository(user);
}
