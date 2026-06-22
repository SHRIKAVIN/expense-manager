import { db, uid } from "./db";
import { DEFAULT_CATEGORIES } from "./defaults";
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
import { monthKey } from "@/lib/format";

export class RepositoryError extends Error {
  code: "forbidden" | "not_found" | "validation";
  constructor(code: RepositoryError["code"], message: string) {
    super(message);
    this.name = "RepositoryError";
    this.code = code;
  }
}

/* ---------- Role policy (enforced in the data layer, not just the UI) ---------- */

export const RolePolicy = {
  canWriteExpenses: (role: Role) => role === "Owner" || role === "Member",
  /** Categories + budget limits are configuration — Owner only. */
  canManageConfig: (role: Role) => role === "Owner",
  /** Recurring rules generate expenses, so members may manage their own. */
  canManageRecurring: (role: Role) => role === "Owner" || role === "Member",
  canExportData: (role: Role) => role === "Owner",
};

export interface ExpenseFilters {
  search?: string;
  categoryId?: string;
  month?: string; // yyyy-mm
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
  /** Idempotently materialize any due recurring rules into expenses. */
  generateDueRecurring(): Promise<Expense[]>;

  exportAll(): Promise<string>;
  wipeUserData(): Promise<void>;
}

function advanceDate(iso: string, frequency: RecurringFrequency): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (frequency === "weekly") date.setDate(date.getDate() + 7);
  else if (frequency === "monthly") date.setMonth(date.getMonth() + 1);
  else date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

export function createRepository(user: SessionUser): ExpenseRepository {
  const userId = user.id;
  const role = user.role;

  const requireWrite = () => {
    if (!RolePolicy.canWriteExpenses(role)) {
      throw new RepositoryError("forbidden", `Role "${role}" cannot modify expenses.`);
    }
  };
  const requireConfig = () => {
    if (!RolePolicy.canManageConfig(role)) {
      throw new RepositoryError("forbidden", `Role "${role}" cannot change categories or budgets.`);
    }
  };
  const requireRecurring = () => {
    if (!RolePolicy.canManageRecurring(role)) {
      throw new RepositoryError("forbidden", `Role "${role}" cannot manage recurring expenses.`);
    }
  };

  return {
    async ensureWorkspace() {
      const existing = await db.categories.where("userId").equals(userId).count();
      if (existing === 0) {
        const now = Date.now();
        const rows: Category[] = DEFAULT_CATEGORIES.map((c, i) => ({
          id: uid("cat"),
          userId,
          name: c.name,
          icon: c.icon,
          archived: false,
          createdAt: now + i,
        }));
        await db.categories.bulkAdd(rows);
      }
    },

    async listCategories(includeArchived = false) {
      const all = await db.categories.where("userId").equals(userId).toArray();
      const filtered = includeArchived ? all : all.filter((c) => !c.archived);
      return filtered.sort((a, b) => a.createdAt - b.createdAt);
    },

    async createCategory(input) {
      requireConfig();
      if (!input.name.trim()) throw new RepositoryError("validation", "Name is required.");
      const cat: Category = {
        id: uid("cat"),
        userId,
        name: input.name.trim(),
        icon: input.icon || "other",
        monthlyBudget: input.monthlyBudget && input.monthlyBudget > 0 ? input.monthlyBudget : undefined,
        archived: false,
        createdAt: Date.now(),
      };
      await db.categories.add(cat);
      return cat;
    },

    async updateCategory(id, patch) {
      requireConfig();
      const cat = await db.categories.get(id);
      if (!cat || cat.userId !== userId) throw new RepositoryError("not_found", "Category not found.");
      const next: Category = {
        ...cat,
        ...patch,
        name: patch.name !== undefined ? patch.name.trim() : cat.name,
      };
      if (patch.monthlyBudget !== undefined) {
        next.monthlyBudget = patch.monthlyBudget > 0 ? patch.monthlyBudget : undefined;
      }
      await db.categories.put(next);
      return next;
    },

    async deleteCategory(id) {
      requireConfig();
      const cat = await db.categories.get(id);
      if (!cat || cat.userId !== userId) throw new RepositoryError("not_found", "Category not found.");
      const inUse = await db.expenses
        .where("userId")
        .equals(userId)
        .filter((e) => e.categoryId === id)
        .count();
      if (inUse > 0) {
        // Keep referential integrity: archive instead of hard-deleting in-use categories.
        await db.categories.put({ ...cat, archived: true });
        return;
      }
      await db.categories.delete(id);
    },

    async listExpenses(filters) {
      let rows = await db.expenses.where("userId").equals(userId).toArray();
      if (filters?.month) rows = rows.filter((e) => monthKey(e.date) === filters.month);
      if (filters?.categoryId) rows = rows.filter((e) => e.categoryId === filters.categoryId);
      if (filters?.search) {
        const q = filters.search.toLowerCase();
        rows = rows.filter(
          (e) =>
            e.merchant.toLowerCase().includes(q) ||
            (e.notes ?? "").toLowerCase().includes(q) ||
            (e.paymentMethod ?? "").toLowerCase().includes(q),
        );
      }
      return rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));
    },

    async getExpense(id) {
      const e = await db.expenses.get(id);
      return e && e.userId === userId ? e : undefined;
    },

    async createExpense(input) {
      requireWrite();
      if (!(input.amount > 0)) throw new RepositoryError("validation", "Amount must be greater than 0.");
      if (!input.categoryId) throw new RepositoryError("validation", "Category is required.");
      const now = Date.now();
      const exp: Expense = {
        id: uid("exp"),
        userId,
        amount: input.amount,
        merchant: input.merchant.trim(),
        categoryId: input.categoryId,
        date: input.date,
        paymentMethod: input.paymentMethod?.trim() || undefined,
        notes: input.notes?.trim() || undefined,
        receiptId: input.receiptId,
        createdAt: now,
        updatedAt: now,
      };
      await db.expenses.add(exp);
      return exp;
    },

    async updateExpense(id, patch) {
      requireWrite();
      const exp = await db.expenses.get(id);
      if (!exp || exp.userId !== userId) throw new RepositoryError("not_found", "Expense not found.");
      if (patch.amount !== undefined && !(patch.amount > 0)) {
        throw new RepositoryError("validation", "Amount must be greater than 0.");
      }
      const next: Expense = { ...exp, ...patch, updatedAt: Date.now() };
      await db.expenses.put(next);
      return next;
    },

    async deleteExpense(id) {
      requireWrite();
      const exp = await db.expenses.get(id);
      if (!exp || exp.userId !== userId) throw new RepositoryError("not_found", "Expense not found.");
      if (exp.receiptId) await db.receipts.delete(exp.receiptId);
      await db.expenses.delete(id);
    },

    async saveReceipt(dataUrl) {
      requireWrite();
      const receipt: Receipt = { id: uid("rcpt"), userId, dataUrl, createdAt: Date.now() };
      await db.receipts.add(receipt);
      return receipt;
    },

    async getReceipt(id) {
      const r = await db.receipts.get(id);
      return r && r.userId === userId ? r : undefined;
    },

    async listRecurring() {
      const rows = await db.recurring.where("userId").equals(userId).toArray();
      return rows.sort((a, b) => (a.nextDue < b.nextDue ? -1 : 1));
    },

    async createRecurring(input) {
      requireRecurring();
      if (!(input.amount > 0)) throw new RepositoryError("validation", "Amount must be greater than 0.");
      const rec: Recurring = {
        id: uid("rec"),
        userId,
        amount: input.amount,
        merchant: input.merchant.trim(),
        categoryId: input.categoryId,
        frequency: input.frequency,
        nextDue: input.nextDue,
        paymentMethod: input.paymentMethod?.trim() || undefined,
        notes: input.notes?.trim() || undefined,
        createdAt: Date.now(),
      };
      await db.recurring.add(rec);
      return rec;
    },

    async updateRecurring(id, patch) {
      requireRecurring();
      const rec = await db.recurring.get(id);
      if (!rec || rec.userId !== userId) throw new RepositoryError("not_found", "Recurring not found.");
      const next = { ...rec, ...patch };
      await db.recurring.put(next);
      return next;
    },

    async deleteRecurring(id) {
      requireRecurring();
      const rec = await db.recurring.get(id);
      if (!rec || rec.userId !== userId) throw new RepositoryError("not_found", "Recurring not found.");
      await db.recurring.delete(id);
    },

    async generateDueRecurring() {
      if (!RolePolicy.canWriteExpenses(role)) return [];
      const today = new Date().toISOString().slice(0, 10);
      const rules = await db.recurring.where("userId").equals(userId).toArray();
      const created: Expense[] = [];
      for (const rule of rules) {
        let guard = 0;
        while (rule.nextDue <= today && guard < 60) {
          guard += 1;
          const period = monthKey(rule.nextDue) + ":" + rule.nextDue;
          // Idempotency: never duplicate for the same rule + due date.
          const exists = await db.expenses
            .where("userId")
            .equals(userId)
            .filter((e) => e.recurringId === rule.id && e.recurringPeriod === period)
            .count();
          if (exists === 0) {
            const now = Date.now();
            const exp: Expense = {
              id: uid("exp"),
              userId,
              amount: rule.amount,
              merchant: rule.merchant,
              categoryId: rule.categoryId,
              date: rule.nextDue,
              paymentMethod: rule.paymentMethod,
              notes: rule.notes,
              recurringId: rule.id,
              recurringPeriod: period,
              createdAt: now,
              updatedAt: now,
            };
            await db.expenses.add(exp);
            created.push(exp);
          }
          rule.nextDue = advanceDate(rule.nextDue, rule.frequency);
        }
        await db.recurring.put(rule);
      }
      return created;
    },

    async exportAll() {
      if (!RolePolicy.canExportData(role)) {
        throw new RepositoryError("forbidden", `Role "${role}" cannot export data.`);
      }
      const [categories, expenses, recurring, receipts] = await Promise.all([
        db.categories.where("userId").equals(userId).toArray(),
        db.expenses.where("userId").equals(userId).toArray(),
        db.recurring.where("userId").equals(userId).toArray(),
        db.receipts.where("userId").equals(userId).toArray(),
      ]);
      return JSON.stringify(
        { exportedAt: new Date().toISOString(), userId, categories, expenses, recurring, receipts },
        null,
        2,
      );
    },

    async wipeUserData() {
      if (role !== "Owner") {
        throw new RepositoryError("forbidden", "Only an Owner can delete the account workspace.");
      }
      await db.transaction("rw", db.categories, db.expenses, db.recurring, db.receipts, async () => {
        await db.categories.where("userId").equals(userId).delete();
        await db.expenses.where("userId").equals(userId).delete();
        await db.recurring.where("userId").equals(userId).delete();
        await db.receipts.where("userId").equals(userId).delete();
      });
    },
  };
}
