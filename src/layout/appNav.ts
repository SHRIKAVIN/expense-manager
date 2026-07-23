import {
  BudgetsNavIcon,
  DashboardNavIcon,
  IncomeNavIcon,
  InsightsNavIcon,
  SettingsNavIcon,
  TransactionsNavIcon,
} from "@/components/NavLottieIcon";

export const APP_NAV = [
  { to: "/", label: "Dashboard", icon: DashboardNavIcon, end: true as const },
  { to: "/transactions", label: "Transactions", icon: TransactionsNavIcon, end: false as const },
  { to: "/income", label: "Income", icon: IncomeNavIcon, end: false as const },
  { to: "/budgets", label: "Budgets", icon: BudgetsNavIcon, end: false as const },
  { to: "/insights", label: "Insights", icon: InsightsNavIcon, end: false as const },
  { to: "/settings", label: "Settings", icon: SettingsNavIcon, end: false as const },
];

export type AppNavItem = (typeof APP_NAV)[number];

export function currentRoute(pathname: string) {
  return (
    APP_NAV.find((n) =>
      n.end ? pathname === n.to : pathname === n.to || pathname.startsWith(`${n.to}/`),
    ) ?? APP_NAV[0]
  );
}
