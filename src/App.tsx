import { lazy, Suspense, useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "@/auth/AuthProvider";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { ToastProvider } from "@/components/Toast";
import { AppDataProvider, useAppData } from "@/data/AppDataProvider";
import { AppShell } from "@/layout/AppShell";
import { DashboardScreen } from "@/screens/DashboardScreen";
import { TransactionsScreen } from "@/screens/TransactionsScreen";
import { BudgetsScreen } from "@/screens/BudgetsScreen";
import { IncomeScreen } from "@/screens/IncomeScreen";
import { SettingsScreen } from "@/screens/SettingsScreen";
import { AuthScreen } from "@/screens/AuthScreen";

// Recharts is heavy — keep it out of the initial bundle and load on demand.
const InsightsScreen = lazy(() =>
  import("@/screens/InsightsScreen").then((m) => ({ default: m.InsightsScreen })),
);
const DevScreen = lazy(() =>
  import("@/screens/DevScreen").then((m) => ({ default: m.DevScreen })),
);
import { PartnerNotificationListener } from "@/features/PartnerNotificationListener";
import { BudgetAlerts } from "@/features/BudgetAlerts";
import { AppLogoMark } from "@/components/AppLogoMark";
import { notify } from "@/lib/notifications";
import { daysUntil, relativeDue } from "@/lib/format";

function Splash() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-canvas">
      <AppLogoMark size={48} className="animate-pulse" />
    </div>
  );
}

function RecurringReminders() {
  const { user } = useAuth();
  const { recurring } = useAppData();

  useEffect(() => {
    if (!user) return;
    if (localStorage.getItem(`em.reminders.${user.id}`) !== "1") return;
    const firedKey = `em.reminders.fired.${user.id}`;
    const fired: string[] = JSON.parse(localStorage.getItem(firedKey) || "[]");
    const next = [...fired];
    for (const r of recurring) {
      const d = daysUntil(r.nextDue);
      const token = `${r.id}:${r.nextDue}`;
      if (d <= 2 && d >= 0 && !fired.includes(token)) {
        notify("Upcoming expense", `${r.merchant} ${relativeDue(r.nextDue)}`);
        next.push(token);
      }
    }
    if (next.length !== fired.length) {
      localStorage.setItem(firedKey, JSON.stringify(next.slice(-50)));
    }
  }, [user, recurring]);

  return null;
}

function AuthedApp() {
  const { ready } = useAppData();
  if (!ready) return <Splash />;
  return (
    <>
      <RecurringReminders />
      <BudgetAlerts />
      <PartnerNotificationListener />
      <AppShell>
        <Suspense fallback={<Splash />}>
          <Routes>
            <Route path="/" element={<DashboardScreen />} />
            <Route path="/transactions" element={<TransactionsScreen />} />
            <Route path="/income" element={<IncomeScreen />} />
            <Route path="/budgets" element={<BudgetsScreen />} />
            <Route path="/insights" element={<InsightsScreen />} />
            <Route path="/settings" element={<SettingsScreen />} />
            <Route path="*" element={<DashboardScreen />} />
          </Routes>
        </Suspense>
      </AppShell>
    </>
  );
}

function Gate() {
  const { status, user } = useAuth();
  if (status === "loading") return <Splash />;
  if (status === "anon") return <AuthScreen />;
  return (
    <AppDataProvider key={user!.id}>
      <AuthedApp />
    </AppDataProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <ToastProvider>
          <Suspense fallback={<Splash />}>
            <Routes>
              <Route path="/dev" element={<DevScreen />} />
              <Route path="/*" element={<Gate />} />
            </Routes>
          </Suspense>
        </ToastProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
