import { db, uid } from "./db";
import { DEFAULT_CATEGORIES } from "./defaults";
import {
  RepositoryError,
  RolePolicy,
  type ExpenseRepository,
} from "./expenseRepository";
import type {
  Category,
  Expense,
  ExpenseInput,
  IncomeEntry,
  Receipt,
  ReimbursementRequest,
  Recurring,
  RecurringFrequency,
  SessionUser,
} from "@/lib/types";
import { monthKey } from "@/lib/format";

function advanceDate(iso: string, frequency: RecurringFrequency): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (frequency === "weekly") date.setDate(date.getDate() + 7);
  else if (frequency === "monthly") date.setMonth(date.getMonth() + 1);
  else date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

/** IndexedDB-backed repository (offline fallback when Supabase is not configured). */
export function createLocalRepository(user: SessionUser): ExpenseRepository {
  const userId = user.id;
  const userEmail = user.email.toLowerCase();
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

    async createExpense(input: ExpenseInput) {
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
      if (input.requestReimbursement) {
        const reimb: ReimbursementRequest = {
          id: uid("reimb"),
          expenseId: exp.id,
          requesterId: userId,
          requesterName: input.requestReimbursement.requesterName,
          payerEmail: input.requestReimbursement.payerEmail.toLowerCase(),
          payerName: input.requestReimbursement.payerName,
          amount: exp.amount,
          merchant: exp.merchant,
          status: "pending",
          createdAt: now,
        };
        await db.reimbursements.add(reimb);
      }
      return exp;
    },

    async updateExpense(id, patch) {
      requireWrite();
      const exp = await db.expenses.get(id);
      if (!exp || exp.userId !== userId) throw new RepositoryError("not_found", "Expense not found.");
      if (exp.excludedFromTotals || exp.reimbursementRequestId) {
        throw new RepositoryError("forbidden", "Reimbursed expenses cannot be edited.");
      }
      if (exp.notes?.includes("Reimbursed from")) {
        throw new RepositoryError("forbidden", "Reimbursed expenses cannot be edited.");
      }
      if (patch.amount !== undefined && !(patch.amount > 0)) {
        throw new RepositoryError("validation", "Amount must be greater than 0.");
      }
      const { requestReimbursement, clearReimbursement, ...expensePatch } = patch;
      const next: Expense = { ...exp, ...expensePatch, updatedAt: Date.now() };
      await db.expenses.put(next);

      const existingReimb = await db.reimbursements
        .where("expenseId")
        .equals(id)
        .filter((r) => r.status !== "completed")
        .first();

      if (patch.clearReimbursement && existingReimb?.status === "pending") {
        await db.reimbursements.delete(existingReimb.id);
      } else if (requestReimbursement && !existingReimb) {
        await db.reimbursements.add({
          id: uid("reimb"),
          expenseId: id,
          requesterId: userId,
          requesterName: requestReimbursement.requesterName,
          payerEmail: requestReimbursement.payerEmail.toLowerCase(),
          payerName: requestReimbursement.payerName,
          amount: next.amount,
          merchant: next.merchant,
          status: "pending",
          createdAt: Date.now(),
        });
      } else if (existingReimb?.status === "pending") {
        await db.reimbursements.update(existingReimb.id, {
          amount: next.amount,
          merchant: next.merchant,
        });
      }

      return next;
    },

    async deleteExpense(id) {
      requireWrite();
      const exp = await db.expenses.get(id);
      if (!exp || exp.userId !== userId) throw new RepositoryError("not_found", "Expense not found.");
      if (exp.receiptId) await db.receipts.delete(exp.receiptId);
      await db.expenses.delete(id);
    },

    async listIncome() {
      const rows = await db.income.where("userId").equals(userId).toArray();
      return rows.sort((a, b) => b.createdAt - a.createdAt);
    },

    async createIncome(input) {
      requireWrite();
      if (!(input.amount > 0)) throw new RepositoryError("validation", "Amount must be greater than 0.");
      if (!/^\d{4}-\d{2}$/.test(input.month)) {
        throw new RepositoryError("validation", "Month must be yyyy-mm.");
      }
      const row: IncomeEntry = {
        id: uid("inc"),
        userId,
        amount: input.amount,
        month: input.month,
        label: input.label?.trim() || undefined,
        createdAt: Date.now(),
      };
      await db.income.add(row);
      return row;
    },

    async deleteIncome(id) {
      requireWrite();
      const row = await db.income.get(id);
      if (!row || row.userId !== userId) throw new RepositoryError("not_found", "Income not found.");
      await db.income.delete(id);
    },

    async listReimbursements() {
      const [asRequester, asPayer] = await Promise.all([
        db.reimbursements.where("requesterId").equals(userId).toArray(),
        db.reimbursements.where("payerEmail").equals(userEmail).toArray(),
      ]);
      const byId = new Map<string, ReimbursementRequest>();
      for (const row of [...asRequester, ...asPayer]) byId.set(row.id, row);
      return [...byId.values()].sort((a, b) => b.createdAt - a.createdAt);
    },

    async markReimbursementPaid(id) {
      requireWrite();
      const req = await db.reimbursements.get(id);
      if (!req || req.status !== "pending") {
        throw new RepositoryError("not_found", "Reimbursement request not found.");
      }
      if (req.payerEmail.toLowerCase() !== userEmail) {
        throw new RepositoryError("forbidden", "You cannot mark this reimbursement paid.");
      }
      await db.reimbursements.update(id, { status: "awaiting_confirmation" });
    },

    async confirmReimbursement(id) {
      requireWrite();
      const req = await db.reimbursements.get(id);
      if (!req || req.status !== "awaiting_confirmation") {
        throw new RepositoryError("not_found", "Reimbursement request not found.");
      }
      if (req.requesterId !== userId) {
        throw new RepositoryError("forbidden", "You cannot confirm this reimbursement.");
      }
      const exp = await db.expenses.get(req.expenseId);
      if (!exp || exp.userId !== req.requesterId) {
        throw new RepositoryError("not_found", "Expense not found.");
      }

      const payer = await db.users
        .filter((u) => u.email.toLowerCase() === req.payerEmail.toLowerCase())
        .first();
      if (!payer) throw new RepositoryError("not_found", "Payer profile not found.");

      const requesterCategory = await db.categories.get(exp.categoryId);
      const payerCategories = await db.categories.where("userId").equals(payer.id).toArray();
      let payerCategoryId =
        payerCategories.find(
          (c) =>
            !c.archived &&
            requesterCategory &&
            c.name.toLowerCase() === requesterCategory.name.toLowerCase(),
        )?.id ??
        payerCategories.find((c) => !c.archived && c.name.toLowerCase() === "other")?.id ??
        payerCategories.find((c) => !c.archived)?.id;
      if (!payerCategoryId) throw new RepositoryError("not_found", "Payer has no categories.");

      let payerReceiptId: string | undefined;
      if (exp.receiptId) {
        const receipt = await db.receipts.get(exp.receiptId);
        if (receipt) {
          const copied: Receipt = {
            id: uid("rcpt"),
            userId: payer.id,
            dataUrl: receipt.dataUrl,
            createdAt: Date.now(),
          };
          await db.receipts.add(copied);
          payerReceiptId = copied.id;
        }
      }

      const transferNote = `Reimbursed from ${req.requesterName}`;
      const now = Date.now();
      const payerExpense: Expense = {
        id: uid("exp"),
        userId: payer.id,
        amount: exp.amount,
        merchant: exp.merchant,
        categoryId: payerCategoryId,
        date: exp.date,
        paymentMethod: exp.paymentMethod,
        notes: exp.notes?.trim() ? `${exp.notes} · ${transferNote}` : transferNote,
        receiptId: payerReceiptId,
        reimbursementRequestId: id,
        createdAt: now,
        updatedAt: now,
      };
      await db.expenses.add(payerExpense);
      await db.expenses.update(exp.id, { excludedFromTotals: true, updatedAt: now });
      await db.reimbursements.update(id, {
        status: "completed",
        completedAt: now,
        payerExpenseId: payerExpense.id,
      });
    },

    async rejectReimbursementPaid(id) {
      requireWrite();
      const req = await db.reimbursements.get(id);
      if (!req || req.status !== "awaiting_confirmation") {
        throw new RepositoryError("not_found", "Reimbursement request not found.");
      }
      if (req.requesterId !== userId) {
        throw new RepositoryError("forbidden", "You cannot reject this reimbursement.");
      }
      await db.reimbursements.update(id, { status: "pending" });
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
      await db.transaction(
        "rw",
        [db.categories, db.expenses, db.recurring, db.receipts, db.income, db.reimbursements],
        async () => {
          await db.categories.where("userId").equals(userId).delete();
          await db.expenses.where("userId").equals(userId).delete();
          await db.recurring.where("userId").equals(userId).delete();
          await db.receipts.where("userId").equals(userId).delete();
          await db.income.where("userId").equals(userId).delete();
          await db.reimbursements.where("requesterId").equals(userId).delete();
        },
      );
    },
  };
}
