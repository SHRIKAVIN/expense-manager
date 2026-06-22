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
import type { ResolvedTheme, ThemePreference } from "@/lib/types";

const LAST_RESOLVED_KEY = "em.theme.lastResolved";

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (pref: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolve(pref: ThemePreference): ResolvedTheme {
  return pref === "system" ? systemTheme() : pref;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user, setThemePreference } = useAuth();
  // Pre-auth (auth/dev screens) the toggle drives a local, non-persisted preference.
  const [localPreference, setLocalPreference] = useState<ThemePreference>("system");
  // Once signed in, the per-user stored preference takes over.
  const preference: ThemePreference = user?.themePreference ?? localPreference;

  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolve(preference));

  // Apply resolved theme to <html> and persist for the anti-flash boot script.
  useEffect(() => {
    const next = resolve(preference);
    setResolved(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(LAST_RESOLVED_KEY, next);
    } catch {
      /* no-op */
    }
  }, [preference]);

  // Live-update when OS theme changes while in "system" mode (no refresh).
  useEffect(() => {
    if (preference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const next = mq.matches ? "dark" : "light";
      setResolved(next);
      document.documentElement.setAttribute("data-theme", next);
      try {
        localStorage.setItem(LAST_RESOLVED_KEY, next);
      } catch {
        /* no-op */
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preference]);

  const setPreference = useCallback(
    (pref: ThemePreference) => {
      setLocalPreference(pref);
      if (user) void setThemePreference(pref);
    },
    [setThemePreference, user],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
