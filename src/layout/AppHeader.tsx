import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { goToDashboard } from "./navigateHome";
import { APP_NAV, currentRoute } from "./appNav";
import { cn } from "@/lib/cn";
import { Sheet } from "@/components/Sheet";
import { IconBadge3D } from "@/components/EmbossedIcon";
import { NavDragPicker } from "@/components/NavDragPicker";
import { MenuNavIcon } from "@/components/NavLottieIcon";
import { ProfileGenderIcon } from "@/components/ProfileGenderIcon";
import { useAuth } from "@/auth/AuthProvider";
import {
  getQuickSwitchAccountName,
  getQuickSwitchGender,
  type QuickSwitchEmail,
} from "@/auth/quickSwitch";
import { useToast } from "@/components/Toast";
import { useAppData } from "@/data/AppDataProvider";
import { pressProps, usePrefersReducedMotion } from "@/lib/motion";
import type { Gender } from "@/lib/types";

function PageIconBadge({ icon: Icon }: { icon: (typeof APP_NAV)[number]["icon"] }) {
  return <IconBadge3D icon={Icon} size="md" />;
}

export function HomeLogoButton({
  className,
  icon: Icon,
}: {
  className?: string;
  icon: (typeof APP_NAV)[number]["icon"];
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { refresh } = useAppData();
  const reduced = usePrefersReducedMotion();

  return (
    <motion.button
      type="button"
      aria-label="Go to dashboard"
      onClick={() => goToDashboard(navigate, pathname, () => void refresh())}
      whileTap={reduced ? undefined : pressProps.whileTap}
      transition={pressProps.transition}
      className={cn("shrink-0 outline-none", className)}
    >
      <PageIconBadge icon={Icon} />
    </motion.button>
  );
}

export function AppHeader() {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { user, canQuickSwitch, quickSwitchUsers, switchQuickUser, isQuickSwitchViewOnly } =
    useAuth();
  const { show } = useToast();
  const reduced = usePrefersReducedMotion();
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
      <header
        className="lg:hidden sticky top-0 z-40 shrink-0 border-b border-hairline glass app-header"
        style={{ paddingTop: "max(env(safe-area-inset-top), 0px)" }}
      >
        <div className="flex h-[var(--app-header-bar)] items-center gap-3 px-4">
          <HomeLogoButton icon={route.icon} />
          <h1 className="text-tagline text-ink flex-1 min-w-0 truncate">{title}</h1>

          {canQuickSwitch && (
            <motion.button
              type="button"
              aria-label="Switch profile"
              aria-expanded={profileOpen}
              data-testid="nav-header-profile-switch"
              disabled={switching}
              onClick={() => setProfileOpen(true)}
              whileTap={reduced ? undefined : pressProps.whileTap}
              transition={pressProps.transition}
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
            </motion.button>
          )}

          <motion.button
            type="button"
            aria-label="Open navigation menu"
            aria-expanded={menuOpen}
            data-testid="nav-menu-open"
            onClick={() => setMenuOpen(true)}
            whileTap={reduced ? undefined : pressProps.whileTap}
            transition={pressProps.transition}
            className="h-14 w-14 -mr-2 flex items-center justify-center rounded-md text-ink outline-none shrink-0"
          >
            <MenuNavIcon size={68} />
          </motion.button>
        </div>
      </header>

      <Sheet open={profileOpen} onClose={() => setProfileOpen(false)} title="Switch profile">
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
                <motion.button
                  key={acc.email}
                  type="button"
                  disabled={switching}
                  data-testid={`nav-profile-switch-${acc.name.toLowerCase()}`}
                  onClick={() => void handleQuickSwitch(acc.email)}
                  whileTap={reduced || switching ? undefined : pressProps.whileTap}
                  transition={pressProps.transition}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 text-left outline-none border transition-colors",
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
                </motion.button>
              );
            })}
          </div>
        </div>
      </Sheet>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Navigate">
        <NavDragPicker
          pathname={pathname}
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
        />
      </Sheet>
    </>
  );
}
