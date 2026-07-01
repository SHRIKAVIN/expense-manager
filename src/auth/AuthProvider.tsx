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
  signup: (input: SignupInput) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<User, "displayName" | "currency">>) => Promise<void>;
  setThemePreference: (pref: ThemePreference) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [status, setStatus] = useState<"loading" | "authed" | "anon">("loading");
  const [configError] = useState<string | null>(() =>
    isSupabaseEnabled()
      ? null
      : "Supabase is not configured. Copy .env.example to .env.local and add your project keys.",
  );

  useEffect(() => {
    if (!isSupabaseEnabled()) {
      setStatus("anon");
      return;
    }

    let cancelled = false;
    const sb = getSupabase();

    const loadSession = async () => {
      try {
        const { data: { user: authUser }, error } = await sb.auth.getUser();
        if (error) throw error;
        if (cancelled) return;
        if (!authUser) {
          setUser(null);
          setStatus("anon");
          return;
        }
        const profile = await ensureProfile(authUser);
        if (cancelled) return;
        setUser(profile);
        setStatus("authed");
      } catch {
        if (!cancelled) {
          setUser(null);
          setStatus("anon");
        }
      }
    };

    sb.auth.getSession().then(({ data: { session } }) => {
      if (session) void loadSession();
      else if (!cancelled) setStatus("anon");
    });

    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((_event, session) => {
      if (session) void loadSession();
      else {
        setUser(null);
        setStatus("anon");
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

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
    if (error) throw new Error(error.message);

    if (data.session && data.user) {
      const profile = await ensureProfile(data.user);
      setUser(profile);
      setStatus("authed");
      return;
    }

    throw new Error(
      "Account created. Check your email to confirm, then sign in.",
    );
  }, [configError]);

  const login = useCallback(async (emailRaw: string, password: string) => {
    if (!isSupabaseEnabled()) throw new Error(configError ?? "Supabase not configured.");
    const email = emailRaw.trim().toLowerCase();
    const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    if (!data.user) throw new Error("Sign in failed.");

    const profile = await ensureProfile(data.user);
    setUser(profile);
    setStatus("authed");
  }, [configError]);

  const logout = useCallback(async () => {
    if (isSupabaseEnabled()) {
      await getSupabase().auth.signOut();
    }
    setUser(null);
    setStatus("anon");
  }, []);

  const updateProfile = useCallback(
    async (patch: Partial<Pick<User, "displayName" | "currency">>) => {
      if (!user || !isSupabaseEnabled()) return;
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
      setUser(profileToSession(data));
    },
    [user],
  );

  const setThemePreference = useCallback(
    async (pref: ThemePreference) => {
      if (!user || !isSupabaseEnabled()) return;
      const { data, error } = await getSupabase()
        .from("profiles")
        .update({ theme_preference: pref })
        .eq("id", user.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      setUser(profileToSession(data));
    },
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      configError,
      signup,
      login,
      logout,
      updateProfile,
      setThemePreference,
    }),
    [user, status, configError, signup, login, logout, updateProfile, setThemePreference],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
