import { db, uid } from "@/data/db";
import type { ExpenseInput } from "@/lib/types";
import { isSupabaseEnabled } from "@/lib/supabase/client";

export type OfflineOpType = "createExpense" | "updateExpense" | "deleteExpense";

export interface OfflineOp {
  id: string;
  userId: string;
  type: OfflineOpType;
  /** For create: ExpenseInput. For update: { id, patch }. For delete: { id }. */
  payload: unknown;
  createdAt: number;
}

declare module "@/data/db" {
  // Augment via versioned store — table accessed via (db as ExpenseDB & { pendingOps }).
}

const STORE = "em.offlineOps.v1";

function readAll(): OfflineOp[] {
  try {
    const raw = localStorage.getItem(STORE);
    return raw ? (JSON.parse(raw) as OfflineOp[]) : [];
  } catch {
    return [];
  }
}

function writeAll(ops: OfflineOp[]) {
  try {
    localStorage.setItem(STORE, JSON.stringify(ops));
  } catch {
    /* quota */
  }
}

export function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/** Queue only when using Supabase cloud and the device is offline. */
export function shouldQueueWrites(): boolean {
  return isSupabaseEnabled() && isOffline();
}

export function listOfflineOps(userId: string): OfflineOp[] {
  return readAll()
    .filter((o) => o.userId === userId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function enqueueOfflineOp(
  userId: string,
  type: OfflineOpType,
  payload: unknown,
): OfflineOp {
  const op: OfflineOp = {
    id: uid("opq"),
    userId,
    type,
    payload,
    createdAt: Date.now(),
  };
  const all = readAll();
  all.push(op);
  writeAll(all);
  return op;
}

export function clearOfflineOp(id: string) {
  writeAll(readAll().filter((o) => o.id !== id));
}

export function clearOfflineOpsForUser(userId: string) {
  writeAll(readAll().filter((o) => o.userId !== userId));
}

export type OfflineFlushRepo = {
  createExpense: (input: ExpenseInput) => Promise<unknown>;
  updateExpense: (id: string, patch: Partial<ExpenseInput>) => Promise<unknown>;
  deleteExpense: (id: string) => Promise<void>;
};

/** Drain queued ops in order. Stops on first failure. Returns count flushed. */
export async function flushOfflineOps(
  userId: string,
  repo: OfflineFlushRepo,
): Promise<{ flushed: number; remaining: number }> {
  const ops = listOfflineOps(userId);
  let flushed = 0;
  for (const op of ops) {
    try {
      if (op.type === "createExpense") {
        await repo.createExpense(op.payload as ExpenseInput);
      } else if (op.type === "updateExpense") {
        const { id, patch } = op.payload as { id: string; patch: Partial<ExpenseInput> };
        await repo.updateExpense(id, patch);
      } else if (op.type === "deleteExpense") {
        const { id } = op.payload as { id: string };
        await repo.deleteExpense(id);
      }
      clearOfflineOp(op.id);
      flushed += 1;
    } catch {
      break;
    }
  }
  return { flushed, remaining: listOfflineOps(userId).length };
}

// Keep Dexie import referenced so tree-shaking doesn't drop db if unused elsewhere from this module.
void db;
