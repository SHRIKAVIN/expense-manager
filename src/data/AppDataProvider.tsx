import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/auth/AuthProvider";
import { createRepository, RolePolicy, type ExpenseRepository } from "./expenseRepository";
import {
  readWorkspaceCache,
  writeWorkspaceCache,
} from "@/lib/cache/userCache";
import { formatCurrency, monthKey, todayISO } from "@/lib/format";
import { expensesForTotals as filterExpensesForTotals } from "@/lib/analytics";
import { notifyPush } from "@/lib/notifications";
import {
  notifyPartnerExpenseAdded,
  notifyPartnerReimbursementConfirmed,
  notifyPartnerReimbursementMarkedPaid,
  notifyPartnerReimbursementRejected,
  notifyPartnerReimbursementUpdated,
} from "@/lib/partnerNotify";
import {
  enqueueOfflineOp,
  flushOfflineOps,
  listOfflineOps,
  shouldQueueWrites,
} from "@/lib/offlineQueue";
import { advanceRecurringDate } from "@/lib/recurringDate";
import type {
  Category,
  Expense,
  ExpenseInput,
  IncomeEntry,
  IncomeInput,
  Recurring,
  ReimbursementRequest,
  RecurringFrequency,
  Role,
} from "@/lib/types";

interface AppDataContextValue {
  ready: boolean;
  repo: ExpenseRepository;
  categories: Category[];
  expenses: Expense[];
  /** Expenses that count toward spent totals (excludes reimbursed requester entries). */
  expensesForTotals: Expense[];
  income: IncomeEntry[];
  reimbursements: ReimbursementRequest[];
  /** Pending reimbursements the current user asked for (maps expense id → request). */
  reimbursementByExpenseId: Record<string, ReimbursementRequest>;
  /** Pending reimbursements waiting for the requester to confirm payment. */
  reimbursementsToConfirm: ReimbursementRequest[];
  /** Pending reimbursements the current user must pay back. */
  reimbursementsToPay: ReimbursementRequest[];
  /** Pending reimbursements others owe the current user (awaiting their payment). */
  reimbursementsAwaitingCollection: ReimbursementRequest[];
  recurring: Recurring[];
  categoriesById: Record<string, Category>;
  /** Count of expense writes waiting to sync while offline. */
  pendingSyncCount: number;
  // permissions surfaced to the UI (and re-enforced in the repo layer)
  can: {
    writeExpenses: boolean;
    manageConfig: boolean;
    manageRecurring: boolean;
    exportData: boolean;
  };
  refresh: () => Promise<void>;
  addExpense: (input: ExpenseInput) => Promise<void>;
  editExpense: (id: string, patch: Partial<ExpenseInput>) => Promise<void>;
  removeExpense: (id: string) => Promise<void>;
  /** One-tap log a recurring rule as an expense and advance nextDue. */
  logRecurring: (id: string) => Promise<void>;
  addIncome: (input: IncomeInput) => Promise<void>;
  removeIncome: (id: string) => Promise<void>;
  markReimbursementPaid: (id: string) => Promise<void>;
  confirmReimbursement: (id: string) => Promise<void>;
  rejectReimbursementPaid: (id: string) => Promise<void>;
  addCategory: (input: { name: string; icon: string; monthlyBudget?: number }) => Promise<void>;
  editCategory: (
    id: string,
    patch: Partial<Pick<Category, "name" | "icon" | "monthlyBudget" | "archived">>,
  ) => Promise<void>;
  removeCategory: (id: string) => Promise<void>;
  addRecurring: (input: {
    amount: number;
    merchant: string;
    categoryId: string;
    frequency: RecurringFrequency;
    nextDue: string;
    paymentMethod?: string;
    notes?: string;
  }) => Promise<void>;
  editRecurring: (id: string, patch: Partial<Recurring>) => Promise<void>;
  removeRecurring: (id: string) => Promise<void>;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { user, isQuickSwitchViewOnly } = useAuth();
  if (!user) throw new Error("AppDataProvider requires an authenticated user");

  const effectiveRole: Role = isQuickSwitchViewOnly ? "Viewer" : user.role;
  const repoUserKey = `${user.id}:${user.email}:${effectiveRole}:${user.currency}`;
  const repoUser = useMemo(
    () => (effectiveRole === user.role ? user : { ...user, role: effectiveRole }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [repoUserKey],
  );
  const repo = useMemo(() => createRepository(repoUser), [repoUser]);
  const cachedWorkspace = useMemo(() => readWorkspaceCache(user.id), [user.id]);
  const [ready, setReady] = useState(() => Boolean(cachedWorkspace || user));
  const [categories, setCategories] = useState<Category[]>(() => cachedWorkspace?.categories ?? []);
  const [expenses, setExpenses] = useState<Expense[]>(() => cachedWorkspace?.expenses ?? []);
  const [income, setIncome] = useState<IncomeEntry[]>(() => cachedWorkspace?.income ?? []);
  const [reimbursements, setReimbursements] = useState<ReimbursementRequest[]>(
    () => cachedWorkspace?.reimbursements ?? [],
  );
  const [recurring, setRecurring] = useState<Recurring[]>(() => cachedWorkspace?.recurring ?? []);
  const [pendingSyncCount, setPendingSyncCount] = useState(() => listOfflineOps(user.id).length);

  const refreshPendingSync = useCallback(() => {
    setPendingSyncCount(listOfflineOps(user.id).length);
  }, [user.id]);

  const refresh = useCallback(async () => {
    const [cats, exps, inc, reimb, recs] = await Promise.all([
      repo.listCategories(true),
      repo.listExpenses(),
      repo.listIncome(),
      repo.listReimbursements(),
      repo.listRecurring(),
    ]);
    setCategories(cats);
    setExpenses(exps);
    setIncome(inc);
    setReimbursements(reimb);
    setRecurring(recs);
    writeWorkspaceCache(user.id, {
      categories: cats,
      expenses: exps,
      income: inc,
      reimbursements: reimb,
      recurring: recs,
    });
  }, [repo, user.id]);

  const syncOfflineQueue = useCallback(async () => {
    if (shouldQueueWrites()) return;
    const { flushed } = await flushOfflineOps(user.id, repo);
    refreshPendingSync();
    if (flushed > 0) await refresh();
  }, [repo, user.id, refresh, refreshPendingSync]);

  useEffect(() => {
    const onOnline = () => {
      void syncOfflineQueue();
    };
    window.addEventListener("online", onOnline);
    void syncOfflineQueue();
    return () => window.removeEventListener("online", onOnline);
  }, [syncOfflineQueue]);

  useEffect(() => {
    let cancelled = false;
    const cached = readWorkspaceCache(user.id);

    if (cached) {
      setCategories(cached.categories ?? []);
      setExpenses(cached.expenses ?? []);
      setIncome(cached.income ?? []);
      setReimbursements(cached.reimbursements ?? []);
      setRecurring(cached.recurring ?? []);
    }

    (async () => {
      try {
        await repo.ensureWorkspace();
        await repo.generateDueRecurring();
        await refresh();
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user.id, repoUserKey, repo, refresh]);

  const addExpense = useCallback(
    async (input: ExpenseInput) => {
      if (shouldQueueWrites()) {
        if (input.receiptId || input.requestReimbursement) {
          throw new Error("Receipts and splits need a connection — try again when online.");
        }
        enqueueOfflineOp(user.id, "createExpense", input);
        const now = Date.now();
        const optimistic: Expense = {
          id: `local_${now}`,
          userId: user.id,
          amount: input.amount,
          merchant: input.merchant.trim() || "Untitled",
          categoryId: input.categoryId,
          date: input.date,
          paymentMethod: input.paymentMethod,
          notes: input.notes,
          recurringId: input.recurringId,
          recurringPeriod: input.recurringPeriod,
          createdAt: now,
          updatedAt: now,
        };
        setExpenses((prev) => [optimistic, ...prev]);
        refreshPendingSync();
        return;
      }
      const created = await repo.createExpense(input);
      await refresh();
      const amount = formatCurrency(created.amount, user.currency);
      if (input.requestReimbursement) {
        void notifyPush("Reimbursement requested", `${amount} at ${created.merchant}`);
      } else {
        void notifyPush("Expense added", `${amount} at ${created.merchant}`);
      }
      void notifyPartnerExpenseAdded(user, created, Boolean(input.requestReimbursement));
    },
    [repo, refresh, user, refreshPendingSync],
  );
  const editExpense = useCallback(
    async (id: string, patch: Partial<ExpenseInput>) => {
      if (shouldQueueWrites()) {
        if (patch.receiptId || patch.requestReimbursement || patch.clearReimbursement) {
          throw new Error("Receipts and splits need a connection — try again when online.");
        }
        enqueueOfflineOp(user.id, "updateExpense", { id, patch });
        setExpenses((prev) =>
          prev.map((e) =>
            e.id === id
              ? {
                  ...e,
                  ...patch,
                  merchant: patch.merchant?.trim() ?? e.merchant,
                  updatedAt: Date.now(),
                }
              : e,
          ),
        );
        refreshPendingSync();
        return;
      }
      const existingReimb = reimbursements.find(
        (r) => r.expenseId === id && r.status !== "completed",
      );
      const hadReimb = Boolean(existingReimb);
      await repo.updateExpense(id, patch);
      await refresh();
      if (!user) return;

      if (patch.requestReimbursement && !hadReimb) {
        const updated = (await repo.listExpenses({})).find((e) => e.id === id);
        if (updated) {
          void notifyPartnerExpenseAdded(user, updated, true);
        }
        return;
      }

      if (
        existingReimb?.status === "pending" &&
        !patch.clearReimbursement &&
        (patch.amount !== undefined ||
          patch.merchant !== undefined ||
          patch.requestReimbursement?.amount !== undefined)
      ) {
        void notifyPartnerReimbursementUpdated(user, {
          ...existingReimb,
          amount: patch.requestReimbursement?.amount ?? patch.amount ?? existingReimb.amount,
          merchant: patch.merchant ?? existingReimb.merchant,
        });
      }
    },
    [repo, refresh, reimbursements, user, refreshPendingSync],
  );
  const removeExpense = useCallback(
    async (id: string) => {
      if (shouldQueueWrites()) {
        enqueueOfflineOp(user.id, "deleteExpense", { id });
        setExpenses((prev) => prev.filter((e) => e.id !== id));
        refreshPendingSync();
        return;
      }
      await repo.deleteExpense(id);
      await refresh();
    },
    [repo, refresh, user.id, refreshPendingSync],
  );

  const logRecurring = useCallback(
    async (id: string) => {
      const rule = recurring.find((r) => r.id === id);
      if (!rule) throw new Error("Recurring expense not found.");
      const period = `${monthKey(rule.nextDue)}:${rule.nextDue}`;
      const already = expenses.some(
        (e) => e.recurringId === rule.id && e.recurringPeriod === period,
      );
      if (already) throw new Error("Already logged for this period.");

      await addExpense({
        amount: rule.amount,
        merchant: rule.merchant,
        categoryId: rule.categoryId,
        date: todayISO(),
        paymentMethod: rule.paymentMethod,
        notes: rule.notes,
        recurringId: rule.id,
        recurringPeriod: period,
      });

      const nextDue = advanceRecurringDate(rule.nextDue, rule.frequency);
      if (shouldQueueWrites()) {
        setRecurring((prev) => prev.map((r) => (r.id === id ? { ...r, nextDue } : r)));
      } else {
        await repo.updateRecurring(id, { nextDue } as Partial<Recurring>);
        await refresh();
      }
    },
    [recurring, expenses, addExpense, repo, refresh],
  );
  const addIncome = useCallback(
    async (input: IncomeInput) => {
      const created = await repo.createIncome(input);
      setIncome((prev) => [created, ...prev.filter((e) => e.id !== created.id)]);
      try {
        await refresh();
      } catch {
        /* keep optimistic row if background refresh fails */
      }
    },
    [repo, refresh],
  );
  const removeIncome = useCallback(
    async (id: string) => {
      await repo.deleteIncome(id);
      await refresh();
    },
    [repo, refresh],
  );
  const markReimbursementPaid = useCallback(
    async (id: string) => {
      const req = reimbursements.find((r) => r.id === id);
      await repo.markReimbursementPaid(id);
      await refresh();
      if (req) {
        void notifyPush("Marked as paid", `${formatCurrency(req.amount, user.currency)} to ${req.requesterName}`);
        void notifyPartnerReimbursementMarkedPaid(user, req);
      }
    },
    [repo, refresh, reimbursements, user],
  );
  const confirmReimbursement = useCallback(
    async (id: string) => {
      const req = reimbursements.find((r) => r.id === id);
      await repo.confirmReimbursement(id);
      await refresh();
      if (req) {
        void notifyPush("Reimbursement confirmed", `${formatCurrency(req.amount, user.currency)} from ${req.payerName} — expense moved to ${req.payerName}`);
        void notifyPartnerReimbursementConfirmed(user, req);
      }
    },
    [repo, refresh, reimbursements, user],
  );
  const rejectReimbursementPaid = useCallback(
    async (id: string) => {
      const req = reimbursements.find((r) => r.id === id);
      await repo.rejectReimbursementPaid(id);
      await refresh();
      if (req) {
        void notifyPush("Payment not confirmed", `${req.payerName} will be notified`);
        void notifyPartnerReimbursementRejected(user, req);
      }
    },
    [repo, refresh, reimbursements, user],
  );
  const addCategory = useCallback(
    async (input: { name: string; icon: string; monthlyBudget?: number }) => {
      await repo.createCategory(input);
      await refresh();
    },
    [repo, refresh],
  );
  const editCategory = useCallback(
    async (
      id: string,
      patch: Partial<Pick<Category, "name" | "icon" | "monthlyBudget" | "archived">>,
    ) => {
      await repo.updateCategory(id, patch);
      await refresh();
    },
    [repo, refresh],
  );
  const removeCategory = useCallback(
    async (id: string) => {
      await repo.deleteCategory(id);
      await refresh();
    },
    [repo, refresh],
  );
  const addRecurring = useCallback(
    async (input: {
      amount: number;
      merchant: string;
      categoryId: string;
      frequency: RecurringFrequency;
      nextDue: string;
      paymentMethod?: string;
      notes?: string;
    }) => {
      await repo.createRecurring(input);
      await repo.generateDueRecurring();
      await refresh();
    },
    [repo, refresh],
  );
  const editRecurring = useCallback(
    async (id: string, patch: Partial<Recurring>) => {
      await repo.updateRecurring(id, patch);
      await refresh();
    },
    [repo, refresh],
  );
  const removeRecurring = useCallback(
    async (id: string) => {
      await repo.deleteRecurring(id);
      await refresh();
    },
    [repo, refresh],
  );

  const categoriesById = useMemo(() => {
    const map: Record<string, Category> = {};
    for (const c of categories) map[c.id] = c;
    return map;
  }, [categories]);

  const expensesForTotals = useMemo(
    () => filterExpensesForTotals(expenses),
    [expenses],
  );

  const activeReimbursements = useMemo(
    () => reimbursements.filter((r) => r.status !== "completed"),
    [reimbursements],
  );

  const requesterExpenseIds = useMemo(
    () => new Set(expenses.filter((e) => e.userId === user.id).map((e) => e.id)),
    [expenses, user.id],
  );

  const reimbursementByExpenseId = useMemo(() => {
    const map: Record<string, ReimbursementRequest> = {};
    for (const r of activeReimbursements) {
      if (r.requesterId === user.id && requesterExpenseIds.has(r.expenseId)) {
        map[r.expenseId] = r;
      }
    }
    return map;
  }, [activeReimbursements, requesterExpenseIds, user.id]);

  const reimbursementsToPay = useMemo(
    () =>
      activeReimbursements.filter(
        (r) =>
          r.status === "pending" &&
          r.payerEmail.toLowerCase() === user.email.toLowerCase(),
      ),
    [activeReimbursements, user.email],
  );

  const reimbursementsToConfirm = useMemo(
    () =>
      activeReimbursements.filter(
        (r) =>
          r.status === "awaiting_confirmation" &&
          r.requesterId === user.id &&
          requesterExpenseIds.has(r.expenseId),
      ),
    [activeReimbursements, requesterExpenseIds, user.id],
  );

  const reimbursementsAwaitingCollection = useMemo(
    () =>
      activeReimbursements.filter(
        (r) =>
          r.status === "pending" &&
          r.requesterId === user.id &&
          requesterExpenseIds.has(r.expenseId),
      ),
    [activeReimbursements, requesterExpenseIds, user.id],
  );

  const can = useMemo(
    () => ({
      writeExpenses: RolePolicy.canWriteExpenses(effectiveRole),
      manageConfig: RolePolicy.canManageConfig(effectiveRole),
      manageRecurring: RolePolicy.canManageRecurring(effectiveRole),
      exportData: RolePolicy.canExportData(effectiveRole),
    }),
    [effectiveRole],
  );

  const value = useMemo<AppDataContextValue>(
    () => ({
      ready,
      repo,
      categories,
      expenses,
      expensesForTotals,
      income,
      reimbursements,
      reimbursementByExpenseId,
      reimbursementsToConfirm,
      reimbursementsToPay,
      reimbursementsAwaitingCollection,
      recurring,
      categoriesById,
      pendingSyncCount,
      can,
      refresh,
      addExpense,
      editExpense,
      removeExpense,
      logRecurring,
      addIncome,
      removeIncome,
      markReimbursementPaid,
      confirmReimbursement,
      rejectReimbursementPaid,
      addCategory,
      editCategory,
      removeCategory,
      addRecurring,
      editRecurring,
      removeRecurring,
    }),
    [
      ready,
      repo,
      categories,
      expenses,
      expensesForTotals,
      income,
      reimbursements,
      reimbursementByExpenseId,
      reimbursementsToConfirm,
      reimbursementsToPay,
      reimbursementsAwaitingCollection,
      recurring,
      categoriesById,
      pendingSyncCount,
      can,
      refresh,
      addExpense,
      editExpense,
      removeExpense,
      logRecurring,
      addIncome,
      removeIncome,
      markReimbursementPaid,
      confirmReimbursement,
      rejectReimbursementPaid,
      addCategory,
      editCategory,
      removeCategory,
      addRecurring,
      editRecurring,
      removeRecurring,
    ],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}
