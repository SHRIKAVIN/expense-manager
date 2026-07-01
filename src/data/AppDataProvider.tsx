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
  Recurring,
  RecurringFrequency,
} from "@/lib/types";

interface AppDataContextValue {
  ready: boolean;
  repo: ExpenseRepository;
  categories: Category[];
  expenses: Expense[];
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

  const repo = useMemo(() => createRepository(user), [user]);
  const cachedWorkspace = useMemo(() => readWorkspaceCache(user.id), [user.id]);
  const [ready, setReady] = useState(() => cachedWorkspace !== null);
  const [categories, setCategories] = useState<Category[]>(() => cachedWorkspace?.categories ?? []);
  const [expenses, setExpenses] = useState<Expense[]>(() => cachedWorkspace?.expenses ?? []);
  const [recurring, setRecurring] = useState<Recurring[]>(() => cachedWorkspace?.recurring ?? []);

  const refresh = useCallback(async () => {
    const [cats, exps, recs] = await Promise.all([
      repo.listCategories(true),
      repo.listExpenses(),
      repo.listRecurring(),
    ]);
    setCategories(cats);
    setExpenses(exps);
    setRecurring(recs);
    writeWorkspaceCache(user.id, {
      categories: cats,
      expenses: exps,
      recurring: recs,
    });
  }, [repo, user.id]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await repo.ensureWorkspace();
      await repo.generateDueRecurring();
      await refresh();
      if (!cancelled) setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [refresh, repo]);

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
      recurring,
      categoriesById,
      can,
      refresh,
      addExpense,
      editExpense,
      removeExpense,
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
      recurring,
      categoriesById,
      can,
      refresh,
      addExpense,
      editExpense,
      removeExpense,
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
