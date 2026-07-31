import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { HomeIcon } from "@/lib/icons";
import { Fab } from "@/components/Fab";
import { ExpenseSheet } from "@/features/ExpenseSheet";
import { IncomeSheet } from "@/features/IncomeSheet";
import { useAppData } from "@/data/AppDataProvider";
import { useAuth } from "@/auth/AuthProvider";
import { getQuickSwitchAccountName } from "@/auth/quickSwitch";
import { getIncomeSelectedMonth } from "@/lib/incomeUiState";
import { liquidSpring, pressProps, usePrefersReducedMotion } from "@/lib/motion";
import { useToast } from "@/components/Toast";
import { clearAppBadge } from "@/lib/appBadge";
import { ProfileGenderIcon } from "@/components/ProfileGenderIcon";
import { ScrolledContext } from "./scroll";
import { AppHeader, HomeLogoButton } from "./AppHeader";
import { APP_NAV, type AppNavItem } from "./appNav";

// The add-expense FAB only belongs where capturing a new expense is in context.
const EXPENSE_FAB_ROUTES = ["/", "/transactions", "/budgets"];
const INCOME_FAB_ROUTE = "/income";

export function AppShell({ children }: { children: ReactNode }) {
  const { can, refresh } = useAppData();
  const { isQuickSwitchViewOnly, user, canQuickSwitch, quickSwitchUsers, switchQuickUser } = useAuth();
  const { show } = useToast();
  const location = useLocation();
  const reduced = usePrefersReducedMotion();
  const [addOpen, setAddOpen] = useState(false);
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const scrollRef = useRef<HTMLElement>(null);
  const viewOnlyToastFor = useRef<string | null>(null);
  const showExpenseFab = can.writeExpenses && EXPENSE_FAB_ROUTES.includes(location.pathname);
  const showIncomeFab = can.writeExpenses && location.pathname === INCOME_FAB_ROUTE;
  const showFab = showExpenseFab || showIncomeFab;

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: 0,
      behavior: reduced ? "auto" : "smooth",
    });
    setScrolled(false);
  }, [location.pathname, reduced]);

  useEffect(() => {
    if (isQuickSwitchViewOnly && user?.email) {
      if (viewOnlyToastFor.current !== user.email) {
        const name = getQuickSwitchAccountName(user.email) ?? user.displayName;
        show(`View only · ${name}`);
        viewOnlyToastFor.current = user.email;
      }
      return;
    }
    viewOnlyToastFor.current = null;
  }, [isQuickSwitchViewOnly, user?.displayName, user?.email, show]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void clearAppBadge();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    if (document.visibilityState === "visible") {
      void clearAppBadge();
    }
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  return (
    <ScrolledContext.Provider value={scrolled}>
      <div
        className={cn(
          "bg-canvas text-ink overflow-hidden",
          "fixed inset-0 w-full flex flex-col",
          "lg:flex-row",
        )}
      >
        {/* Left rail (desktop) */}
        <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 lg:h-full lg:overflow-y-auto lg:scroll-smooth border-r border-hairline bg-canvas-parchment px-3 py-8 justify-between">
          <div>
            <div className="px-3 mb-8 flex items-center gap-2">
              <HomeLogoButton icon={HomeIcon} />
              <span className="text-tagline text-ink">Expenses</span>
            </div>
            <nav className="relative flex flex-col gap-1">
              {APP_NAV.map((item) => (
                <RailLink key={item.to} {...item} reduced={reduced} onRefresh={() => void refresh()} />
              ))}
            </nav>
          </div>

          {canQuickSwitch && (
            <div className="px-1 mt-auto pt-6 border-t border-hairline flex flex-col gap-2">
              <span className="text-fine-print text-ink-muted-48 uppercase tracking-wider font-semibold px-2">
                Switch Profile
              </span>
              {quickSwitchUsers.map((acc) => {
                const active = user?.email.toLowerCase() === acc.email;
                return (
                  <motion.button
                    key={acc.email}
                    type="button"
                    disabled={active}
                    onClick={() => void switchQuickUser(acc.email)}
                    whileTap={reduced || active ? undefined : pressProps.whileTap}
                    transition={pressProps.transition}
                    className={cn(
                      "flex items-center gap-2 rounded-xl px-3 py-2 text-caption font-medium outline-none transition-colors w-full text-left",
                      active
                        ? "bg-primary text-on-primary"
                        : "text-ink hover:bg-canvas border border-transparent",
                    )}
                  >
                    <ProfileGenderIcon gender={acc.gender} size={28} />
                    <span className="truncate flex-1">{acc.name}</span>
                  </motion.button>
                );
              })}
            </div>
          )}
        </aside>

        <div className="relative flex-1 min-h-0 min-w-0 flex flex-col">
          <main
            ref={scrollRef}
            onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 6)}
            className={cn(
              "flex-1 min-h-0 overflow-y-auto overflow-x-hidden scroll-smooth lg:pb-12",
              showFab
                ? "pb-[calc(var(--fab-bottom-offset)+5.75rem)]"
                : "pb-[var(--fab-bottom-offset)]",
            )}
          >
            <AppHeader />
            <motion.div
              key={location.pathname}
              initial={reduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduced ? 0 : 0.18, ease: "easeOut" }}
            >
              {children}
            </motion.div>
          </main>

          {showExpenseFab && <Fab onClick={() => setAddOpen(true)} />}
          {showIncomeFab && (
            <Fab
              onClick={() => setIncomeOpen(true)}
              label="Add income"
              data-testid="fab-add-income"
            />
          )}
        </div>
      </div>

      <ExpenseSheet open={addOpen} onClose={() => setAddOpen(false)} />
      <IncomeSheet
        open={incomeOpen}
        onClose={() => setIncomeOpen(false)}
        defaultMonth={getIncomeSelectedMonth()}
      />
    </ScrolledContext.Provider>
  );
}

function RailLink({
  to,
  label,
  icon: Icon,
  end,
  reduced,
  onRefresh,
}: {
  to: string;
  label: string;
  icon: AppNavItem["icon"];
  end?: boolean;
  reduced: boolean;
  onRefresh: () => void;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      data-testid={`nav-rail-${to === "/" ? "dashboard" : to.slice(1)}`}
      className="relative block outline-none"
      onClick={(e) => {
        if (e.currentTarget.getAttribute("aria-current") === "page") {
          e.preventDefault();
          onRefresh();
        }
      }}
    >
      {({ isActive }) => (
        <motion.span
          className={cn(
            "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-body",
            isActive ? "text-primary" : "text-ink-muted-80",
          )}
          whileTap={reduced ? undefined : pressProps.whileTap}
          transition={pressProps.transition}
        >
          {isActive && (
            <motion.span
              layoutId={reduced ? undefined : "desktop-rail-pill"}
              className="liquid-nav-pill absolute inset-0 rounded-xl"
              transition={reduced ? { duration: 0 } : liquidSpring}
            />
          )}
          <motion.span
            className="relative"
            animate={reduced ? undefined : { scale: isActive ? 1.06 : 1 }}
            transition={liquidSpring}
          >
            <Icon size={38} strokeWidth={isActive ? 2.1 : 1.8} />
          </motion.span>
          <span className={cn("relative", isActive ? "text-body-strong" : "text-body")}>
            {label}
          </span>
        </motion.span>
      )}
    </NavLink>
  );
}
