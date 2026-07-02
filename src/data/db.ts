import Dexie, { type Table } from "dexie";
import type {
  Category,
  Expense,
  IncomeEntry,
  Recurring,
  Receipt,
  ReimbursementRequest,
  User,
} from "@/lib/types";

/**
 * Local persistence. Every row except `users` is namespaced by `userId`,
 * so each account is a fully isolated workspace (no shared/leaked data).
 */
export class ExpenseDB extends Dexie {
  users!: Table<User, string>;
  categories!: Table<Category, string>;
  expenses!: Table<Expense, string>;
  receipts!: Table<Receipt, string>;
  recurring!: Table<Recurring, string>;
  income!: Table<IncomeEntry, string>;
  reimbursements!: Table<ReimbursementRequest, string>;

  constructor() {
    super("expense-manager");
    this.version(1).stores({
      users: "id, email",
      categories: "id, userId, [userId+archived]",
      expenses: "id, userId, [userId+date], categoryId, receiptId",
      receipts: "id, userId",
      recurring: "id, userId, [userId+nextDue]",
    });
    this.version(2).stores({
      users: "id, email",
      categories: "id, userId, [userId+archived]",
      expenses: "id, userId, [userId+date], categoryId, receiptId",
      receipts: "id, userId",
      recurring: "id, userId, [userId+nextDue]",
      income: "id, userId, [userId+month]",
    });
    this.version(3).stores({
      users: "id, email",
      categories: "id, userId, [userId+archived]",
      expenses: "id, userId, [userId+date], categoryId, receiptId",
      receipts: "id, userId",
      recurring: "id, userId, [userId+nextDue]",
      income: "id, userId, [userId+month]",
      reimbursements: "id, requesterId, expenseId, [payerEmail+status]",
    });
  }
}

export const db = new ExpenseDB();

export function uid(prefix = ""): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return prefix ? `${prefix}_${rand}` : rand;
}
