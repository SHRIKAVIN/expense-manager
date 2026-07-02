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
import { usePrefersReducedMotion } from "@/lib/motion";
import { useToast } from "@/components/Toast";
import { ScrolledContext } from "./scroll";
import { AppHeader, APP_NAV, HomeLogoButton } from "./AppHeader";

// The add-expense FAB only belongs where capturing a new expense is in context.
const EXPENSE_FAB_ROUTES = ["/", "/transactions", "/budgets"];
const INCOME_FAB_ROUTE = "/income";

export function AppShell({ children }: { children: ReactNode }) {
  const { can } = useAppData();
  const { isQuickSwitchViewOnly, user } = useAuth();
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
    scrollRef.current?.scrollTo({ top: 0 });
    setScrolled(false);
  }, [location.pathname]);

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
        <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 lg:h-full lg:overflow-y-auto border-r border-hairline bg-canvas-parchment px-3 py-8">
          <div className="px-3 mb-8 flex items-center gap-2">
            <HomeLogoButton icon={HomeIcon} />
            <span className="text-tagline text-ink">Expenses</span>
          </div>
          <nav className="flex flex-col gap-1">
            {APP_NAV.map((item) => (
              <RailLink key={item.to} {...item} />
            ))}
          </nav>
        </aside>

        <div className="relative flex-1 min-h-0 min-w-0 flex flex-col">
          <main
            ref={scrollRef}
            onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 6)}
            className={cn(
              "flex-1 min-h-0 overflow-y-auto overflow-x-hidden lg:pb-12",
              showFab
                ? "pb-[calc(var(--fab-bottom-offset)+4.25rem)]"
                : "pb-[var(--fab-bottom-offset)]",
            )}
          >
            <AppHeader />
            <motion.div
              key={location.pathname}
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: reduced ? 0 : 0.15, ease: "easeOut" }}
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
}: {
  to: string;
  label: string;
  icon: (typeof APP_NAV)[number]["icon"];
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      data-testid={`nav-rail-${to === "/" ? "dashboard" : to.slice(1)}`}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-md px-3 py-2.5 text-body outline-none",
          isActive ? "text-primary" : "text-ink-muted-80",
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
  );
}
