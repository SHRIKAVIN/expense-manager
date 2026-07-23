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
import { ProfileGenderIcon } from "@/components/ProfileGenderIcon";
import { useAuth } from "@/auth/AuthProvider";
import {
  getQuickSwitchAccountName,
  getQuickSwitchGender,
  type QuickSwitchEmail,
} from "@/auth/quickSwitch";
import { useToast } from "@/components/Toast";
import type { Gender } from "@/lib/types";

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
  const [profileOpen, setProfileOpen] = useState(false);
  const { user, canQuickSwitch, quickSwitchUsers, switchQuickUser, isQuickSwitchViewOnly } =
    useAuth();
  const { show } = useToast();
  const route = currentRoute(pathname);
  const title = route.label;
  const [switching, setSwitching] = useState(false);

  const currentName = user?.email
    ? (getQuickSwitchAccountName(user.email) ?? user.displayName)
    : "";
  const currentGender: Gender | undefined =
    user?.gender ?? (user?.email ? (getQuickSwitchGender(user.email) ?? undefined) : undefined);

  const handleQuickSwitch = async (email: QuickSwitchEmail) => {
    if (switching) return;
    if (user?.email.toLowerCase() === email.toLowerCase()) {
      setProfileOpen(false);
      return;
    }
    setSwitching(true);
    try {
      await switchQuickUser(email);
      const name = getQuickSwitchAccountName(email);
      show(name ? `Switched profile to ${name}` : "Switched profile");
      setProfileOpen(false);
    } catch (err) {
      show(err instanceof Error ? err.message : "Failed to switch account.");
    } finally {
      setSwitching(false);
    }
  };

  return (
    <>
      <header className="lg:hidden sticky top-0 z-40 shrink-0 border-b border-hairline glass app-header">
        <div className="flex h-[var(--app-header-bar)] items-center gap-3 px-4">
          <HomeLogoButton icon={route.icon} />
          <h1 className="text-tagline text-ink flex-1 min-w-0 truncate">{title}</h1>

          {canQuickSwitch && (
            <button
              type="button"
              aria-label="Switch profile"
              aria-expanded={profileOpen}
              data-testid="nav-header-profile-switch"
              disabled={switching}
              onClick={() => setProfileOpen(true)}
              className={cn(
                "relative h-10 w-10 flex items-center justify-center rounded-full outline-none shrink-0 border transition-colors",
                isQuickSwitchViewOnly
                  ? "border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "border-hairline bg-canvas-parchment text-ink hover:bg-canvas",
              )}
            >
              <ProfileGenderIcon gender={currentGender} size={40} strokeWidth={2} />
              {isQuickSwitchViewOnly && (
                <span
                  className="absolute top-1 right-1 h-2 w-2 rounded-full bg-amber-500"
                  aria-hidden
                />
              )}
            </button>
          )}

          <button
            type="button"
            aria-label="Open navigation menu"
            aria-expanded={menuOpen}
            data-testid="nav-menu-open"
            onClick={() => setMenuOpen(true)}
            className="h-10 w-10 -mr-1 flex items-center justify-center rounded-md text-ink outline-none shrink-0"
          >
            <MenuIcon size={24} strokeWidth={2.1} />
          </button>
        </div>
      </header>

      <Sheet
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        title="Switch profile"
      >
        <div className="flex flex-col gap-3" data-testid="nav-profile-switch-sheet">
          <p className="text-caption text-ink-muted-48">
            {isQuickSwitchViewOnly
              ? `Viewing ${currentName} · read only`
              : `Signed in as ${currentName}`}
          </p>
          <div className="flex flex-col gap-2">
            {quickSwitchUsers.map((acc) => {
              const active = user?.email.toLowerCase() === acc.email;
              return (
                <button
                  key={acc.email}
                  type="button"
                  disabled={switching}
                  data-testid={`nav-profile-switch-${acc.name.toLowerCase()}`}
                  onClick={() => void handleQuickSwitch(acc.email)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-4 py-3 text-left outline-none border transition-colors",
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-hairline bg-canvas text-ink hover:bg-canvas-parchment",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                      active ? "bg-primary text-on-primary" : "bg-canvas-parchment text-ink-muted-80",
                    )}
                  >
                    <ProfileGenderIcon gender={acc.gender} size={40} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-body-strong truncate">{acc.name}</span>
                    <span className="block text-caption text-ink-muted-48 truncate">
                      {active
                        ? isQuickSwitchViewOnly
                          ? "Viewing now"
                          : "Current profile"
                        : "Tap to switch"}
                    </span>
                  </span>
                  {active && (
                    <span className="text-caption text-primary shrink-0">Active</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </Sheet>

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
