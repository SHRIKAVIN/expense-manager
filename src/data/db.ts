import Dexie, { type Table } from "dexie";
import type {
  Category,
  Expense,
  Recurring,
  Receipt,
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

  constructor() {
    super("expense-manager");
    this.version(1).stores({
      users: "id, email",
      categories: "id, userId, [userId+archived]",
      expenses: "id, userId, [userId+date], categoryId, receiptId",
      receipts: "id, userId",
      recurring: "id, userId, [userId+nextDue]",
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
