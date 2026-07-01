import type { Category, Expense, Recurring, SessionUser } from "@/lib/types";

const PROFILE_PREFIX = "em.profile.v1.";
const WORKSPACE_PREFIX = "em.workspace.v1.";
const LAST_USER_KEY = "em.lastUserId";

export function rememberUserId(userId: string): void {
  try {
    localStorage.setItem(LAST_USER_KEY, userId);
  } catch {
    /* no-op */
  }
}

export function clearUserCache(userId?: string): void {
  try {
    const id = userId ?? localStorage.getItem(LAST_USER_KEY) ?? undefined;
    if (id) {
      localStorage.removeItem(`${PROFILE_PREFIX}${id}`);
      localStorage.removeItem(`${WORKSPACE_PREFIX}${id}`);
    }
    localStorage.removeItem(LAST_USER_KEY);
  } catch {
    /* no-op */
  }
}

export function readProfileCache(userId: string): SessionUser | null {
  try {
    const raw = localStorage.getItem(`${PROFILE_PREFIX}${userId}`);
    if (!raw) return null;
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export function writeProfileCache(user: SessionUser): void {
  try {
    localStorage.setItem(`${PROFILE_PREFIX}${user.id}`, JSON.stringify(user));
    rememberUserId(user.id);
  } catch {
    /* no-op */
  }
}

export interface WorkspaceCache {
  categories: Category[];
  expenses: Expense[];
  recurring: Recurring[];
}

export function readWorkspaceCache(userId: string): WorkspaceCache | null {
  try {
    const raw = localStorage.getItem(`${WORKSPACE_PREFIX}${userId}`);
    if (!raw) return null;
    return JSON.parse(raw) as WorkspaceCache;
  } catch {
    return null;
  }
}

export function writeWorkspaceCache(userId: string, data: WorkspaceCache): void {
  try {
    localStorage.setItem(`${WORKSPACE_PREFIX}${userId}`, JSON.stringify(data));
  } catch {
    /* no-op */
  }
}

/** Restore auth from the last signed-in profile (sync, before Supabase responds). */
export function readCachedAuthedUser(): SessionUser | null {
  try {
    const userId = localStorage.getItem(LAST_USER_KEY);
    if (!userId) return null;
    return readProfileCache(userId);
  } catch {
    return null;
  }
}
