import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { goToDashboard } from "./navigateHome";
import { cn } from "@/lib/cn";
import {
  ChartIcon,
  HomeIcon,
  ListIcon,
  MenuIcon,
  SettingsIcon,
  WalletIcon,
} from "@/lib/icons";
import { Sheet } from "@/components/Sheet";

export const APP_NAV = [
  { to: "/", label: "Dashboard", icon: HomeIcon, end: true as const },
  { to: "/transactions", label: "Transactions", icon: ListIcon, end: false as const },
  { to: "/budgets", label: "Budgets", icon: WalletIcon, end: false as const },
  { to: "/insights", label: "Insights", icon: ChartIcon, end: false as const },
  { to: "/settings", label: "Settings", icon: SettingsIcon, end: false as const },
];

function currentRoute(pathname: string) {
  return (
    APP_NAV.find((n) =>
      n.end ? pathname === n.to : pathname === n.to || pathname.startsWith(`${n.to}/`),
    ) ?? APP_NAV[0]
  );
}

function PageIconBadge({ icon: Icon }: { icon: (typeof APP_NAV)[number]["icon"] }) {
  return (
    <div
      className="h-10 w-10 rounded-sm bg-primary text-on-primary flex items-center justify-center shrink-0"
      aria-hidden
    >
      <Icon size={20} strokeWidth={2} />
    </div>
  );
}

export function HomeLogoButton({ className }: { className?: string }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <button
      type="button"
      aria-label="Go to dashboard"
      onClick={() => goToDashboard(navigate, pathname)}
      className={cn("shrink-0 outline-none", className)}
    >
      <PageIconBadge icon={HomeIcon} />
    </button>
  );
}

export function AppHeader() {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const route = currentRoute(pathname);
  const title = route.label;

  return (
    <>
      <header className="lg:hidden sticky top-0 z-40 shrink-0 border-b border-hairline glass app-header">
        <div className="flex h-[var(--app-header-bar)] items-center gap-3 px-4">
          <HomeLogoButton />
          <h1 className="text-tagline text-ink flex-1 min-w-0 truncate">{title}</h1>
          <button
            type="button"
            aria-label="Open navigation menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
            className="h-10 w-10 -mr-2 flex items-center justify-center rounded-md text-ink outline-none"
          >
            <MenuIcon size={22} />
          </button>
        </div>
      </header>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Navigate">
        <nav className="flex flex-col gap-1 -mx-2">
          {APP_NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-3 text-body outline-none",
                  isActive
                    ? "bg-canvas-parchment text-primary"
                    : "text-ink hover:bg-canvas-parchment/60",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={22} strokeWidth={isActive ? 2.1 : 1.8} />
                  <span className={isActive ? "text-body-strong" : "text-body"}>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </Sheet>
    </>
  );
}
