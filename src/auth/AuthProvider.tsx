import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getSupabase, isSupabaseEnabled } from "@/lib/supabase/client";
import { ensureProfile } from "@/lib/supabase/ensureProfile";
import { profileToSession } from "@/lib/supabase/mappers";
import {
  activateQuickSwitchUser,
  cacheCurrentQuickSwitchSession,
  getQuickSwitchHomeEmail,
  isQuickSwitchEmail,
  isQuickSwitchViewOnly,
  QUICK_SWITCH_USERS,
  setQuickSwitchHomeEmail,
  type QuickSwitchAccount,
  type QuickSwitchEmail,
} from "@/auth/quickSwitch";
import {
  clearUserCache,
  readCachedAuthedUser,
  readProfileCache,
  writeProfileCache,
} from "@/lib/cache/userCache";
import type { Role, SessionUser, ThemePreference, User } from "@/lib/types";

interface SignupInput {
  email: string;
  password: string;
  displayName: string;
  role: Role;
  currency: string;
}

interface AuthContextValue {
  user: SessionUser | null;
  status: "loading" | "authed" | "anon";
  configError: string | null;
  authScreenMode: "login" | "signup";
  setAuthScreenMode: (mode: "login" | "signup") => void;
  signup: (input: SignupInput) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<User, "displayName" | "currency">>) => Promise<void>;
  setThemePreference: (pref: ThemePreference) => Promise<void>;
  quickSwitchUsers: readonly QuickSwitchAccount[];
  canQuickSwitch: boolean;
  /** Viewing partner account via quick switch — read-only, no edits. */
  isQuickSwitchViewOnly: boolean;
  switchQuickUser: (email: QuickSwitchEmail) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const cachedUser = isSupabaseEnabled() ? readCachedAuthedUser() : null;
  const [user, setUser] = useState<SessionUser | null>(cachedUser);
  const [status, setStatus] = useState<"loading" | "authed" | "anon">(() => {
    if (!isSupabaseEnabled()) return "anon";
    return cachedUser ? "authed" : "loading";
  });
  const [authScreenMode, setAuthScreenMode] = useState<"login" | "signup">("login");
  const [configError] = useState<string | null>(() =>
    isSupabaseEnabled()
      ? null
      : "Supabase is not configured. Copy .env.example to .env.local and add your project keys.",
  );

  const applyUser = useCallback((profile: SessionUser) => {
    writeProfileCache(profile);
    setUser(profile);
    setStatus("authed");
  }, []);

  useEffect(() => {
    if (!isSupabaseEnabled()) {
      setStatus("anon");
      return;
    }

    let cancelled = false;
    const sb = getSupabase();

    const refreshProfile = async (userId: string) => {
      try {
        const profile = await ensureProfile(userId);
        if (!cancelled) applyUser(profile);
      } catch {
        if (!cancelled) {
          clearUserCache(userId);
          setUser(null);
          setStatus("anon");
        }
      }
    };

    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;

      if (session?.user) {
        const email = session.user.email?.toLowerCase();
        if (email && isQuickSwitchEmail(email)) {
          void cacheCurrentQuickSwitchSession(email);
          if (!getQuickSwitchHomeEmail()) {
            setQuickSwitchHomeEmail(email);
          }
        }
        const cached = readProfileCache(session.user.id);
        if (cached) applyUser(cached);
        void refreshProfile(session.user.id);
        return;
      }

      if (event === "SIGNED_OUT" || event === "INITIAL_SESSION") {
        setAuthScreenMode("login");
      }
      clearUserCache();
      setUser(null);
      setStatus("anon");
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [applyUser]);

  const signup = useCallback(async (input: SignupInput) => {
    if (!isSupabaseEnabled()) throw new Error(configError ?? "Supabase not configured.");
    const email = input.email.trim().toLowerCase();
    if (!email) throw new Error("Email is required.");
    if (input.password.length < 6) throw new Error("Password must be at least 6 characters.");

    const { data, error } = await getSupabase().auth.signUp({
      email,
      password: input.password,
      options: {
        data: {
          display_name: input.displayName.trim() || email.split("@")[0],
          role: input.role,
          currency: input.currency,
        },
      },
    });
    if (error) {
      if (error.code === "user_already_exists") {
        throw new Error("An account with this email already exists. Sign in instead.");
      }
      throw new Error(error.message);
    }

    if (data.session && data.user) {
      applyUser(await ensureProfile(data.user.id));
      setQuickSwitchHomeEmail(email);
      return;
    }

    throw new Error(
      "Account created. Check your email to confirm, then sign in.",
    );
  }, [applyUser, configError]);

  const login = useCallback(async (emailRaw: string, password: string) => {
    if (!isSupabaseEnabled()) throw new Error(configError ?? "Supabase not configured.");
    const email = emailRaw.trim().toLowerCase();
    const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
    if (error) {
      const code = error.code ?? "";
      const msg = error.message.toLowerCase();
      const noAccount =
        code === "user_not_found" ||
        msg.includes("user not found") ||
        msg.includes("no user found") ||
        code === "invalid_credentials" ||
        msg.includes("invalid login credentials");

      if (noAccount) {
        setAuthScreenMode("signup");
        throw new Error("No account found for this email. Create one below.");
      }
      throw new Error(error.message);
    }
    if (!data.user) throw new Error("Sign in failed.");

    applyUser(await ensureProfile(data.user.id));
    setQuickSwitchHomeEmail(email);
    void cacheCurrentQuickSwitchSession(email);
  }, [applyUser, configError]);

  const logout = useCallback(async () => {
    clearUserCache(user?.id);
    if (isSupabaseEnabled()) {
      await getSupabase().auth.signOut();
    }
    try {
      localStorage.removeItem("em.quickSwitch.homeEmail");
    } catch {
      /* no-op */
    }
    setAuthScreenMode("login");
    setUser(null);
    setStatus("anon");
  }, [user?.id]);

  const updateProfile = useCallback(
    async (patch: Partial<Pick<User, "displayName" | "currency">>) => {
      if (!user || !isSupabaseEnabled()) return;
      if (isQuickSwitchViewOnly(user.email)) {
        throw new Error("View only.");
      }
      const updates: Record<string, string> = {};
      if (patch.displayName !== undefined) updates.display_name = patch.displayName.trim();
      if (patch.currency !== undefined) updates.currency = patch.currency;

      const { data, error } = await getSupabase()
        .from("profiles")
        .update(updates)
        .eq("id", user.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      applyUser(profileToSession(data));
    },
    [applyUser, user],
  );

  const setThemePreference = useCallback(
    async (pref: ThemePreference) => {
      if (!user || !isSupabaseEnabled()) return;
      if (isQuickSwitchViewOnly(user.email)) {
        throw new Error("View only.");
      }
      const { data, error } = await getSupabase()
        .from("profiles")
        .update({ theme_preference: pref })
        .eq("id", user.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      applyUser(profileToSession(data));
    },
    [applyUser, user],
  );

  const switchQuickUser = useCallback(
    async (email: QuickSwitchEmail) => {
      if (!isSupabaseEnabled()) throw new Error(configError ?? "Supabase not configured.");
      const currentEmail = user?.email?.toLowerCase();
      if (currentEmail && isQuickSwitchEmail(currentEmail)) {
        await cacheCurrentQuickSwitchSession(currentEmail);
      }
      clearUserCache(user?.id);
      await activateQuickSwitchUser(email);
      const { data: { session } } = await getSupabase().auth.getSession();
      if (session?.user) {
        applyUser(await ensureProfile(session.user.id));
      }
    },
    [applyUser, configError, user?.email, user?.id],
  );

  const canQuickSwitch = Boolean(user?.email && isQuickSwitchEmail(user.email));
  const isQuickSwitchViewOnlyMode = Boolean(user?.email && isQuickSwitchViewOnly(user.email));

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      configError,
      authScreenMode,
      setAuthScreenMode,
      signup,
      login,
      logout,
      updateProfile,
      setThemePreference,
      quickSwitchUsers: QUICK_SWITCH_USERS,
      canQuickSwitch,
      isQuickSwitchViewOnly: isQuickSwitchViewOnlyMode,
      switchQuickUser,
    }),
    [
      user,
      status,
      configError,
      authScreenMode,
      signup,
      login,
      logout,
      updateProfile,
      setThemePreference,
      canQuickSwitch,
      isQuickSwitchViewOnlyMode,
      switchQuickUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
