import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/auth/AuthProvider";
import { createRepository, RolePolicy, type ExpenseRepository } from "./expenseRepository";
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
  const [ready, setReady] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [recurring, setRecurring] = useState<Recurring[]>([]);
  const bootstrapped = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    const [cats, exps, recs] = await Promise.all([
      repo.listCategories(true),
      repo.listExpenses(),
      repo.listRecurring(),
    ]);
    setCategories(cats);
    setExpenses(exps);
    setRecurring(recs);
  }, [repo]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setReady(false);
      await repo.ensureWorkspace();
      // Materialize any due recurring rules (idempotent, role-checked internally).
      await repo.generateDueRecurring();
      await refresh();
      if (!cancelled) {
        bootstrapped.current = user.id;
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [repo, refresh, user.id]);

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
