import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { db, uid } from "@/data/db";
import { hashPasscode } from "@/lib/hash";
import type { Role, SessionUser, ThemePreference, User } from "@/lib/types";

const SESSION_KEY = "em.session.userId";

interface SignupInput {
  email: string;
  passcode: string;
  displayName: string;
  role: Role;
  currency: string;
}

interface AuthContextValue {
  user: SessionUser | null;
  status: "loading" | "authed" | "anon";
  signup: (input: SignupInput) => Promise<void>;
  login: (email: string, passcode: string) => Promise<void>;
  logout: () => void;
  updateProfile: (patch: Partial<Pick<User, "displayName" | "currency">>) => Promise<void>;
  setThemePreference: (pref: ThemePreference) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toSession(u: User): SessionUser {
  const { passHash: _passHash, ...rest } = u;
  return rest;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [status, setStatus] = useState<"loading" | "authed" | "anon">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const id = localStorage.getItem(SESSION_KEY);
      if (id) {
        const u = await db.users.get(id);
        if (!cancelled && u) {
          setUser(toSession(u));
          setStatus("authed");
          return;
        }
      }
      if (!cancelled) setStatus("anon");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signup = useCallback(async (input: SignupInput) => {
    const email = input.email.trim().toLowerCase();
    if (!email) throw new Error("Email is required.");
    if (input.passcode.length < 4) throw new Error("Passcode must be at least 4 characters.");
    const existing = await db.users.where("email").equals(email).first();
    if (existing) throw new Error("An account with that email already exists.");

    const newUser: User = {
      id: uid("usr"),
      email,
      passHash: await hashPasscode(input.passcode),
      displayName: input.displayName.trim() || email.split("@")[0],
      role: input.role,
      currency: input.currency,
      themePreference: "system",
      createdAt: Date.now(),
    };
    await db.users.add(newUser);
    localStorage.setItem(SESSION_KEY, newUser.id);
    setUser(toSession(newUser));
    setStatus("authed");
  }, []);

  const login = useCallback(async (emailRaw: string, passcode: string) => {
    const email = emailRaw.trim().toLowerCase();
    const u = await db.users.where("email").equals(email).first();
    if (!u) throw new Error("No account found for that email.");
    const hash = await hashPasscode(passcode);
    if (hash !== u.passHash) throw new Error("Incorrect passcode.");
    localStorage.setItem(SESSION_KEY, u.id);
    setUser(toSession(u));
    setStatus("authed");
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
    setStatus("anon");
  }, []);

  const updateProfile = useCallback(
    async (patch: Partial<Pick<User, "displayName" | "currency">>) => {
      if (!user) return;
      const u = await db.users.get(user.id);
      if (!u) return;
      const next = { ...u, ...patch };
      await db.users.put(next);
      setUser(toSession(next));
    },
    [user],
  );

  const setThemePreference = useCallback(
    async (pref: ThemePreference) => {
      if (!user) return;
      const u = await db.users.get(user.id);
      if (!u) return;
      const next = { ...u, themePreference: pref };
      await db.users.put(next);
      setUser(toSession(next));
    },
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, signup, login, logout, updateProfile, setThemePreference }),
    [user, status, signup, login, logout, updateProfile, setThemePreference],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
