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
import type {
  Category,
  Expense,
  ExpenseInput,
  IncomeEntry,
  IncomeInput,
  Recurring,
  ReimbursementRequest,
  RecurringFrequency,
} from "@/lib/types";

interface AppDataContextValue {
  ready: boolean;
  repo: ExpenseRepository;
  categories: Category[];
  expenses: Expense[];
  income: IncomeEntry[];
  reimbursements: ReimbursementRequest[];
  /** Pending reimbursements the current user asked for (maps expense id → request). */
  reimbursementByExpenseId: Record<string, ReimbursementRequest>;
  /** Pending reimbursements the current user must pay back. */
  reimbursementsToPay: ReimbursementRequest[];
  recurring: Recurring[];
  categoriesById: Record<string, Category>;
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
  addIncome: (input: IncomeInput) => Promise<void>;
  removeIncome: (id: string) => Promise<void>;
  completeReimbursement: (id: string) => Promise<void>;
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
  const { user } = useAuth();
  if (!user) throw new Error("AppDataProvider requires an authenticated user");

  const repo = useMemo(() => createRepository(user), [user.id, user.role, user.email]);
  const cachedWorkspace = useMemo(() => readWorkspaceCache(user.id), [user.id]);
  const [ready, setReady] = useState(false);
  const [categories, setCategories] = useState<Category[]>(() => cachedWorkspace?.categories ?? []);
  const [expenses, setExpenses] = useState<Expense[]>(() => cachedWorkspace?.expenses ?? []);
  const [income, setIncome] = useState<IncomeEntry[]>(() => cachedWorkspace?.income ?? []);
  const [reimbursements, setReimbursements] = useState<ReimbursementRequest[]>(
    () => cachedWorkspace?.reimbursements ?? [],
  );
  const [recurring, setRecurring] = useState<Recurring[]>(() => cachedWorkspace?.recurring ?? []);

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

  useEffect(() => {
    let cancelled = false;
    const cached = readWorkspaceCache(user.id);

    setReady(false);
    setCategories(cached?.categories ?? []);
    setExpenses(cached?.expenses ?? []);
    setIncome(cached?.income ?? []);
    setReimbursements(cached?.reimbursements ?? []);
    setRecurring(cached?.recurring ?? []);

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
  }, [user.id, repo, refresh]);

  const addExpense = useCallback(
    async (input: ExpenseInput) => {
      await repo.createExpense(input);
      await refresh();
    },
    [repo, refresh],
  );
  const editExpense = useCallback(
    async (id: string, patch: Partial<ExpenseInput>) => {
      await repo.updateExpense(id, patch);
      await refresh();
    },
    [repo, refresh],
  );
  const removeExpense = useCallback(
    async (id: string) => {
      await repo.deleteExpense(id);
      await refresh();
    },
    [repo, refresh],
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
  const completeReimbursement = useCallback(
    async (id: string) => {
      await repo.completeReimbursement(id);
      await refresh();
    },
    [repo, refresh],
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

  const pendingReimbursements = useMemo(
    () => reimbursements.filter((r) => r.status === "pending"),
    [reimbursements],
  );

  const reimbursementByExpenseId = useMemo(() => {
    const map: Record<string, ReimbursementRequest> = {};
    for (const r of pendingReimbursements) {
      if (r.requesterId === user.id) map[r.expenseId] = r;
    }
    return map;
  }, [pendingReimbursements, user.id]);

  const reimbursementsToPay = useMemo(
    () =>
      pendingReimbursements.filter(
        (r) => r.payerEmail.toLowerCase() === user.email.toLowerCase(),
      ),
    [pendingReimbursements, user.email],
  );

  const can = useMemo(
    () => ({
      writeExpenses: RolePolicy.canWriteExpenses(user.role),
      manageConfig: RolePolicy.canManageConfig(user.role),
      manageRecurring: RolePolicy.canManageRecurring(user.role),
      exportData: RolePolicy.canExportData(user.role),
    }),
    [user.role],
  );

  const value = useMemo<AppDataContextValue>(
    () => ({
      ready,
      repo,
      categories,
      expenses,
      income,
      reimbursements,
      reimbursementByExpenseId,
      reimbursementsToPay,
      recurring,
      categoriesById,
      can,
      refresh,
      addExpense,
      editExpense,
      removeExpense,
      addIncome,
      removeIncome,
      completeReimbursement,
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
      income,
      reimbursements,
      reimbursementByExpenseId,
      reimbursementsToPay,
      recurring,
      categoriesById,
      can,
      refresh,
      addExpense,
      editExpense,
      removeExpense,
      addIncome,
      removeIncome,
      completeReimbursement,
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
