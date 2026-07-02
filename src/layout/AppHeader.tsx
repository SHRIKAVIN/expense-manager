import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { goToDashboard } from "./navigateHome";
import { cn } from "@/lib/cn";
import {
  ChartIcon,
  HomeIcon,
  IncomeIcon,
  ListIcon,
  MenuIcon,
  SettingsIcon,
  WalletIcon,
} from "@/lib/icons";
import { Sheet } from "@/components/Sheet";
import { IconBadge3D } from "@/components/EmbossedIcon";

export const APP_NAV = [
  { to: "/", label: "Dashboard", icon: HomeIcon, end: true as const },
  { to: "/transactions", label: "Transactions", icon: ListIcon, end: false as const },
  { to: "/income", label: "Income", icon: IncomeIcon, end: false as const },
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
  return <IconBadge3D icon={Icon} size="md" />;
}

export function HomeLogoButton({
  className,
  icon: Icon,
}: {
  className?: string;
  /** Page icon for the header badge; tap still goes to dashboard. */
  icon: (typeof APP_NAV)[number]["icon"];
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <button
      type="button"
      aria-label="Go to dashboard"
      onClick={() => goToDashboard(navigate, pathname)}
      className={cn("shrink-0 outline-none", className)}
    >
      <PageIconBadge icon={Icon} />
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
          <HomeLogoButton icon={route.icon} />
          <h1 className="text-tagline text-ink flex-1 min-w-0 truncate">{title}</h1>
          <button
            type="button"
            aria-label="Open navigation menu"
            aria-expanded={menuOpen}
            data-testid="nav-menu-open"
            onClick={() => setMenuOpen(true)}
            className="h-10 w-12 -mr-2 flex items-center justify-center rounded-md text-ink outline-none"
          >
            <MenuIcon size={24} strokeWidth={2.1} />
          </button>
        </div>
      </header>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Navigate">
        <nav className="flex flex-col gap-1 -mx-2" data-testid="nav-menu">
          {APP_NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              data-testid={`nav-link-${to === "/" ? "dashboard" : to.slice(1)}`}
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
                  {isActive ? (
                    <IconBadge3D icon={Icon} size="sm" />
                  ) : (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center text-ink-muted-80">
                      <Icon size={20} strokeWidth={1.8} />
                    </span>
                  )}
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
