import { getSupabase } from "@/lib/supabase/client";

const SESSIONS_KEY = "em.quickSwitch.sessions.v1";

/** Dev/demo quick-switch accounts only — do not use in production builds. */
export const QUICK_SWITCH_USERS = [
  { email: "shrikavinkbs@gmail.com", password: "123456", name: "Shrikavin" },
  { email: "sylviamicheal308@gmail.com", password: "123456", name: "Sylvia" },
] as const;

export type QuickSwitchAccount = (typeof QUICK_SWITCH_USERS)[number];
export type QuickSwitchEmail = QuickSwitchAccount["email"];

type StoredSession = {
  access_token: string;
  refresh_token: string;
};

function readStore(): Partial<Record<string, StoredSession>> {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    return raw ? (JSON.parse(raw) as Partial<Record<string, StoredSession>>) : {};
  } catch {
    return {};
  }
}

function writeStore(store: Partial<Record<string, StoredSession>>) {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(store));
  } catch {
    /* no-op */
  }
}

export function isQuickSwitchEmail(email: string): email is QuickSwitchEmail {
  return QUICK_SWITCH_USERS.some((u) => u.email === email.toLowerCase());
}

/** Other quick-switch user for reimbursement (Shrikavin ↔ Sylvia). */
export function getReimbursementPartner(email: string): QuickSwitchAccount | null {
  const normalized = email.toLowerCase();
  if (!isQuickSwitchEmail(normalized)) return null;
  return QUICK_SWITCH_USERS.find((u) => u.email !== normalized) ?? null;
}

export async function cacheCurrentQuickSwitchSession(email: string) {
  if (!isQuickSwitchEmail(email)) return;
  const sb = getSupabase();
  const { data } = await sb.auth.getSession();
  if (!data.session) return;
  const store = readStore();
  store[email] = {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  };
  writeStore(store);
}

export async function activateQuickSwitchUser(email: QuickSwitchEmail): Promise<void> {
  const sb = getSupabase();
  const normalized = email.toLowerCase();
  const store = readStore();
  const cached = store[normalized];

  if (cached) {
    const { error } = await sb.auth.setSession({
      access_token: cached.access_token,
      refresh_token: cached.refresh_token,
    });
    if (!error) return;
  }

  const account = QUICK_SWITCH_USERS.find((u) => u.email === normalized);
  if (!account) throw new Error("Account not allowed for quick switch.");

  const { data, error } = await sb.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  if (error) throw new Error(error.message);
  if (!data.session) throw new Error("Sign in failed.");

  store[normalized] = {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  };
  writeStore(store);
}
