import { getSupabase } from "@/lib/supabase/client";
import {
  toCategory,
  toExpense,
  toIncome,
  toReimbursement,
  toReceipt,
  toRecurring,
} from "@/lib/supabase/mappers";
import { monthKey } from "@/lib/format";
import { DEFAULT_CATEGORIES } from "./defaults";
import {
  RepositoryError,
  RolePolicy,
  type ExpenseFilters,
  type ExpenseRepository,
} from "./expenseRepository";
import type { Expense, ExpenseInput, RecurringFrequency, SessionUser } from "@/lib/types";

function advanceDate(iso: string, frequency: RecurringFrequency): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (frequency === "weekly") date.setDate(date.getDate() + 7);
  else if (frequency === "monthly") date.setMonth(date.getMonth() + 1);
  else date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

function throwDb(message: string, code: RepositoryError["code"] = "validation"): never {
  const hint =
    message.includes("income_entries") && message.includes("schema cache")
      ? "Income table missing in Supabase. Run supabase/migrations/20260702_income_entries.sql in the SQL editor."
      : message;
  throw new RepositoryError(code, hint);
}

export function createSupabaseRepository(user: SessionUser): ExpenseRepository {
  const userId = user.id;
  const role = user.role;
  const sb = () => getSupabase();

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
      const { count, error: countErr } = await sb()
        .from("categories")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);
      if (countErr) throwDb(countErr.message);
      if ((count ?? 0) > 0) return;

      const rows = DEFAULT_CATEGORIES.map((c) => ({
        user_id: userId,
        name: c.name,
        icon: c.icon,
        archived: false,
      }));
      const { error } = await sb().from("categories").insert(rows);
      if (error) throwDb(error.message);
    },

    async listCategories(includeArchived = false) {
      let q = sb().from("categories").select("*").eq("user_id", userId).order("created_at");
      if (!includeArchived) q = q.eq("archived", false);
      const { data, error } = await q;
      if (error) throwDb(error.message);
      return (data ?? []).map(toCategory);
    },

    async createCategory(input) {
      requireConfig();
      if (!input.name.trim()) throwDb("Name is required.");
      const { data, error } = await sb()
        .from("categories")
        .insert({
          user_id: userId,
          name: input.name.trim(),
          icon: input.icon || "other",
          monthly_budget:
            input.monthlyBudget && input.monthlyBudget > 0 ? input.monthlyBudget : null,
          archived: false,
        })
        .select()
        .single();
      if (error || !data) throwDb(error?.message ?? "Could not create category.");
      return toCategory(data);
    },

    async updateCategory(id, patch) {
      requireConfig();
      const updates: Record<string, unknown> = {};
      if (patch.name !== undefined) updates.name = patch.name.trim();
      if (patch.icon !== undefined) updates.icon = patch.icon;
      if (patch.archived !== undefined) updates.archived = patch.archived;
      if (patch.monthlyBudget !== undefined) {
        updates.monthly_budget = patch.monthlyBudget > 0 ? patch.monthlyBudget : null;
      }
      const { data, error } = await sb()
        .from("categories")
        .update(updates)
        .eq("id", id)
        .eq("user_id", userId)
        .select()
        .single();
      if (error || !data) throwDb(error?.message ?? "Category not found.", "not_found");
      return toCategory(data);
    },

    async deleteCategory(id) {
      requireConfig();
      const { data: cat, error: catErr } = await sb()
        .from("categories")
        .select("*")
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle();
      if (catErr) throwDb(catErr.message);
      if (!cat) throwDb("Category not found.", "not_found");

      const { count, error: countErr } = await sb()
        .from("expenses")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("category_id", id);
      if (countErr) throwDb(countErr.message);

      if ((count ?? 0) > 0) {
        const { error } = await sb()
          .from("categories")
          .update({ archived: true })
          .eq("id", id)
          .eq("user_id", userId);
        if (error) throwDb(error.message);
        return;
      }
      const { error } = await sb().from("categories").delete().eq("id", id).eq("user_id", userId);
      if (error) throwDb(error.message);
    },

    async listExpenses(filters?: ExpenseFilters) {
      const { data, error } = await sb()
        .from("expenses")
        .select("*")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throwDb(error.message);

      let rows = (data ?? []).map(toExpense);
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
      return rows;
    },

    async getExpense(id) {
      const { data, error } = await sb()
        .from("expenses")
        .select("*")
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throwDb(error.message);
      return data ? toExpense(data) : undefined;
    },

    async createExpense(input: ExpenseInput) {
      requireWrite();
      if (!(input.amount > 0)) throwDb("Amount must be greater than 0.");
      if (!input.categoryId) throwDb("Category is required.");
      const now = new Date().toISOString();
      const { data, error } = await sb()
        .from("expenses")
        .insert({
          user_id: userId,
          amount: input.amount,
          merchant: input.merchant.trim(),
          category_id: input.categoryId,
          date: input.date,
          payment_method: input.paymentMethod?.trim() || null,
          notes: input.notes?.trim() || null,
          receipt_id: input.receiptId ?? null,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();
      if (error || !data) throwDb(error?.message ?? "Could not create expense.");
      const expense = toExpense(data);

      if (input.requestReimbursement) {
        const { error: reimbErr } = await sb().from("reimbursement_requests").insert({
          expense_id: expense.id,
          requester_id: userId,
          payer_email: input.requestReimbursement.payerEmail.toLowerCase(),
          payer_name: input.requestReimbursement.payerName,
          requester_name: input.requestReimbursement.requesterName,
          amount: expense.amount,
          merchant: expense.merchant,
          status: "pending",
        });
        if (reimbErr) throwDb(reimbErr.message);
      }

      return expense;
    },

    async updateExpense(id, patch) {
      requireWrite();
      const existing = await this.getExpense(id);
      if (!existing) throwDb("Expense not found.", "not_found");
      if (existing.excludedFromTotals || existing.reimbursementRequestId) {
        throwDb("Reimbursed expenses cannot be edited.", "forbidden");
      }
      if (existing.notes?.includes("Reimbursed from")) {
        throwDb("Reimbursed expenses cannot be edited.", "forbidden");
      }
      if (patch.amount !== undefined && !(patch.amount > 0)) {
        throwDb("Amount must be greater than 0.");
      }
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (patch.amount !== undefined) updates.amount = patch.amount;
      if (patch.merchant !== undefined) updates.merchant = patch.merchant.trim();
      if (patch.categoryId !== undefined) updates.category_id = patch.categoryId;
      if (patch.date !== undefined) updates.date = patch.date;
      if (patch.paymentMethod !== undefined) {
        updates.payment_method = patch.paymentMethod.trim() || null;
      }
      if (patch.notes !== undefined) updates.notes = patch.notes.trim() || null;
      if (patch.receiptId !== undefined) updates.receipt_id = patch.receiptId ?? null;

      const { data, error } = await sb()
        .from("expenses")
        .update(updates)
        .eq("id", id)
        .eq("user_id", userId)
        .select()
        .single();
      if (error || !data) throwDb(error?.message ?? "Expense not found.", "not_found");
      const expense = toExpense(data);

      const { data: existingReimb } = await sb()
        .from("reimbursement_requests")
        .select("id, status")
        .eq("expense_id", id)
        .neq("status", "completed")
        .maybeSingle();

      if (patch.clearReimbursement && existingReimb?.status === "pending") {
        await sb().from("reimbursement_requests").delete().eq("id", existingReimb.id);
      } else if (patch.requestReimbursement && !existingReimb) {
        const { error: reimbErr } = await sb().from("reimbursement_requests").insert({
          expense_id: expense.id,
          requester_id: userId,
          payer_email: patch.requestReimbursement.payerEmail.toLowerCase(),
          payer_name: patch.requestReimbursement.payerName,
          requester_name: patch.requestReimbursement.requesterName,
          amount: expense.amount,
          merchant: expense.merchant,
          status: "pending",
        });
        if (reimbErr) throwDb(reimbErr.message);
      } else if (existingReimb && existingReimb.status === "pending") {
        await sb()
          .from("reimbursement_requests")
          .update({ amount: expense.amount, merchant: expense.merchant })
          .eq("id", existingReimb.id);
      }

      return expense;
    },

    async deleteExpense(id) {
      requireWrite();
      const { data: exp, error: fetchErr } = await sb()
        .from("expenses")
        .select("receipt_id, excluded_from_totals, reimbursement_request_id, notes")
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle();
      if (fetchErr) throwDb(fetchErr.message);
      if (!exp) throwDb("Expense not found.", "not_found");
      if (exp.excluded_from_totals || exp.reimbursement_request_id) {
        throwDb("Reimbursed expenses cannot be deleted.", "forbidden");
      }
      const notes = exp.notes as string | null;
      if (notes?.includes("Reimbursed from")) {
        throwDb("Reimbursed expenses cannot be deleted.", "forbidden");
      }

      const { error } = await sb().from("expenses").delete().eq("id", id).eq("user_id", userId);
      if (error) throwDb(error.message);

      if (exp.receipt_id) {
        await sb().from("receipts").delete().eq("id", exp.receipt_id).eq("user_id", userId);
      }
    },

    async listIncome() {
      const { data, error } = await sb()
        .from("income_entries")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throwDb(error.message);
      return (data ?? []).map(toIncome);
    },

    async createIncome(input) {
      requireWrite();
      if (!(input.amount > 0)) throwDb("Amount must be greater than 0.");
      if (!/^\d{4}-\d{2}$/.test(input.month)) throwDb("Month must be yyyy-mm.");
      const { data, error } = await sb()
        .from("income_entries")
        .insert({
          user_id: userId,
          amount: input.amount,
          month: input.month,
          label: input.label?.trim() || null,
        })
        .select()
        .single();
      if (error || !data) throwDb(error?.message ?? "Could not add income.");
      return toIncome(data);
    },

    async deleteIncome(id) {
      requireWrite();
      const { error } = await sb()
        .from("income_entries")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throwDb(error.message);
    },

    async listReimbursements() {
      const [asRequester, asPayer] = await Promise.all([
        sb().from("reimbursement_requests").select("*").eq("requester_id", userId),
        sb().from("reimbursement_requests").select("*").ilike("payer_email", user.email),
      ]);
      if (asRequester.error) throwDb(asRequester.error.message);
      if (asPayer.error) throwDb(asPayer.error.message);
      const byId = new Map<string, ReturnType<typeof toReimbursement>>();
      for (const row of [...(asRequester.data ?? []), ...(asPayer.data ?? [])]) {
        const mapped = toReimbursement(row);
        byId.set(mapped.id, mapped);
      }
      return [...byId.values()].sort((a, b) => b.createdAt - a.createdAt);
    },

    async markReimbursementPaid(id) {
      requireWrite();
      const { error } = await sb().rpc("mark_reimbursement_paid", { request_id: id });
      if (error) throwDb(error.message);
    },

    async confirmReimbursement(id) {
      requireWrite();
      const { error } = await sb().rpc("confirm_reimbursement", { request_id: id });
      if (error) throwDb(error.message);
    },

    async rejectReimbursementPaid(id) {
      requireWrite();
      const { error } = await sb().rpc("reject_reimbursement_paid", { request_id: id });
      if (error) throwDb(error.message);
    },

    async saveReceipt(dataUrl) {
      requireWrite();
      const { data, error } = await sb()
        .from("receipts")
        .insert({ user_id: userId, data_url: dataUrl })
        .select()
        .single();
      if (error || !data) throwDb(error?.message ?? "Could not save receipt.");
      return toReceipt(data);
    },

    async getReceipt(id) {
      const { data, error } = await sb()
        .from("receipts")
        .select("*")
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throwDb(error.message);
      return data ? toReceipt(data) : undefined;
    },

    async listRecurring() {
      const { data, error } = await sb()
        .from("recurring")
        .select("*")
        .eq("user_id", userId)
        .order("next_due");
      if (error) throwDb(error.message);
      return (data ?? []).map(toRecurring);
    },

    async createRecurring(input) {
      requireRecurring();
      if (!(input.amount > 0)) throwDb("Amount must be greater than 0.");
      const { data, error } = await sb()
        .from("recurring")
        .insert({
          user_id: userId,
          amount: input.amount,
          merchant: input.merchant.trim(),
          category_id: input.categoryId,
          frequency: input.frequency,
          next_due: input.nextDue,
          payment_method: input.paymentMethod?.trim() || null,
          notes: input.notes?.trim() || null,
        })
        .select()
        .single();
      if (error || !data) throwDb(error?.message ?? "Could not create recurring expense.");
      return toRecurring(data);
    },

    async updateRecurring(id, patch) {
      requireRecurring();
      const updates: Record<string, unknown> = {};
      if (patch.amount !== undefined) updates.amount = patch.amount;
      if (patch.merchant !== undefined) updates.merchant = patch.merchant.trim();
      if (patch.categoryId !== undefined) updates.category_id = patch.categoryId;
      if (patch.frequency !== undefined) updates.frequency = patch.frequency;
      if (patch.nextDue !== undefined) updates.next_due = patch.nextDue;
      if (patch.paymentMethod !== undefined) {
        updates.payment_method = patch.paymentMethod.trim() || null;
      }
      if (patch.notes !== undefined) updates.notes = patch.notes.trim() || null;

      const { data, error } = await sb()
        .from("recurring")
        .update(updates)
        .eq("id", id)
        .eq("user_id", userId)
        .select()
        .single();
      if (error || !data) throwDb(error?.message ?? "Recurring not found.", "not_found");
      return toRecurring(data);
    },

    async deleteRecurring(id) {
      requireRecurring();
      const { error } = await sb().from("recurring").delete().eq("id", id).eq("user_id", userId);
      if (error) throwDb(error.message);
    },

    async generateDueRecurring() {
      if (!RolePolicy.canWriteExpenses(role)) return [];
      const today = new Date().toISOString().slice(0, 10);
      const { data: rules, error } = await sb()
        .from("recurring")
        .select("*")
        .eq("user_id", userId);
      if (error) throwDb(error.message);

      const created: Expense[] = [];
      for (const row of rules ?? []) {
        let rule = toRecurring(row);
        let guard = 0;
        while (rule.nextDue <= today && guard < 60) {
          guard += 1;
          const period = monthKey(rule.nextDue) + ":" + rule.nextDue;
          const { count } = await sb()
            .from("expenses")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("recurring_id", rule.id)
            .eq("recurring_period", period);

          if ((count ?? 0) === 0) {
            const now = new Date().toISOString();
            const { data: expRow, error: expErr } = await sb()
              .from("expenses")
              .insert({
                user_id: userId,
                amount: rule.amount,
                merchant: rule.merchant,
                category_id: rule.categoryId,
                date: rule.nextDue,
                payment_method: rule.paymentMethod ?? null,
                notes: rule.notes ?? null,
                recurring_id: rule.id,
                recurring_period: period,
                created_at: now,
                updated_at: now,
              })
              .select()
              .single();
            if (expErr) throwDb(expErr.message);
            if (expRow) created.push(toExpense(expRow));
          }

          const nextDue = advanceDate(rule.nextDue, rule.frequency);
          const { data: updated, error: updErr } = await sb()
            .from("recurring")
            .update({ next_due: nextDue })
            .eq("id", rule.id)
            .eq("user_id", userId)
            .select()
            .single();
          if (updErr) throwDb(updErr.message);
          rule = updated ? toRecurring(updated) : { ...rule, nextDue };
        }
      }
      return created;
    },

    async exportAll() {
      if (!RolePolicy.canExportData(role)) {
        throw new RepositoryError("forbidden", `Role "${role}" cannot export data.`);
      }
      const [categories, expenses, recurring, receipts] = await Promise.all([
        sb().from("categories").select("*").eq("user_id", userId),
        sb().from("expenses").select("*").eq("user_id", userId),
        sb().from("recurring").select("*").eq("user_id", userId),
        sb().from("receipts").select("*").eq("user_id", userId),
      ]);
      return JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          userId,
          categories: (categories.data ?? []).map(toCategory),
          expenses: (expenses.data ?? []).map(toExpense),
          recurring: (recurring.data ?? []).map(toRecurring),
          receipts: (receipts.data ?? []).map(toReceipt),
        },
        null,
        2,
      );
    },

    async wipeUserData() {
      if (role !== "Owner") {
        throw new RepositoryError("forbidden", "Only an Owner can delete the account workspace.");
      }
      await sb().from("expenses").delete().eq("user_id", userId);
      await sb().from("income_entries").delete().eq("user_id", userId);
      await sb().from("reimbursement_requests").delete().eq("requester_id", userId);
      await sb().from("recurring").delete().eq("user_id", userId);
      await sb().from("receipts").delete().eq("user_id", userId);
      await sb().from("categories").delete().eq("user_id", userId);
    },
  };
}
