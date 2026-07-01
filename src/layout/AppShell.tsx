import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import {
  HomeIcon,
  ListIcon,
  WalletIcon,
  ChartIcon,
  SettingsIcon,
} from "@/lib/icons";
import { Fab } from "@/components/Fab";
import { ExpenseSheet } from "@/features/ExpenseSheet";
import { useAppData } from "@/data/AppDataProvider";
import { usePrefersReducedMotion } from "@/lib/motion";
import { ScrolledContext } from "./scroll";

const NAV = [
  { to: "/", label: "Dashboard", icon: HomeIcon, end: true },
  { to: "/transactions", label: "Transactions", icon: ListIcon },
  { to: "/budgets", label: "Budgets", icon: WalletIcon },
  { to: "/insights", label: "Insights", icon: ChartIcon },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

// The add-expense FAB only belongs where capturing a new expense is in context.
const FAB_ROUTES = ["/", "/transactions", "/budgets"];

export function AppShell({ children }: { children: ReactNode }) {
  const { can } = useAppData();
  const location = useLocation();
  const reduced = usePrefersReducedMotion();
  const [addOpen, setAddOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const scrollRef = useRef<HTMLElement>(null);
  const showFab = can.writeExpenses && FAB_ROUTES.includes(location.pathname);

  // Reset the internal scroll position + header state when the route changes.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    setScrolled(false);
  }, [location.pathname]);

  return (
    <ScrolledContext.Provider value={scrolled}>
      {/*
       * Mobile: `h-dvh` flex column (NOT fixed) — iOS standalone resolves dvh to
       * the full screen including the home-indicator region, so a flex-child
       * nav lands at the true bottom. `fixed inset-0` + height APIs leave a gap
       * below the nav in installed PWAs (Chrome in-browser is fine).
       *
       * Desktop: pinned shell with left rail.
       */}
      <div
        className={cn(
          "bg-canvas text-ink overflow-hidden",
          "h-dvh max-h-dvh w-full flex flex-col",
          "lg:fixed lg:inset-0 lg:h-auto lg:max-h-none lg:flex-row",
        )}
      >
        {/* Left rail (desktop) */}
        <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 lg:h-full lg:overflow-y-auto border-r border-hairline bg-canvas-parchment px-3 py-8">
          <div className="px-3 mb-8 flex items-center gap-2">
            <div className="h-8 w-8 rounded-sm bg-primary text-on-primary flex items-center justify-center">
              <WalletIcon size={18} />
            </div>
            <span className="text-tagline text-ink">Expenses</span>
          </div>
          <nav className="flex flex-col gap-1">
            {NAV.map((item) => (
              <RailLink key={item.to} {...item} />
            ))}
          </nav>
        </aside>

        {/* Content column: flex column pushes nav to the physical bottom on iOS. */}
        <div className="relative flex-1 min-h-0 min-w-0 flex flex-col">
          <main
            ref={scrollRef}
            onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 6)}
            className={cn(
              "flex-1 min-h-0 overflow-y-auto overflow-x-hidden lg:pb-12",
              // Reserve room so the floating FAB never sits on top of the last
              // row — it rests over empty space instead. The nav is a sibling
              // (not overlapping), so this only needs to clear the FAB.
              showFab ? "pb-24" : "pb-6",
            )}
          >
            {/* Instant content swap with a light fade-in (no exit wait) per §6. */}
            <motion.div
              key={location.pathname}
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: reduced ? 0 : 0.15, ease: "easeOut" }}
            >
              {children}
            </motion.div>
          </main>

          {/* Bottom tab bar — flex child + .bottom-nav safe-area fill for PWA. */}
          <nav className="lg:hidden shrink-0 z-40 border-t border-hairline glass bottom-nav">
            <div className="flex h-[3.25rem] items-stretch justify-around">
              {NAV.map((item) => (
                <TabLink key={item.to} {...item} />
              ))}
            </div>
          </nav>

          {showFab && <Fab onClick={() => setAddOpen(true)} />}
        </div>
      </div>

      <ExpenseSheet open={addOpen} onClose={() => setAddOpen(false)} />
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
  icon: typeof HomeIcon;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
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

function TabLink({
  to,
  label,
  icon: Icon,
  end,
}: {
  to: string;
  label: string;
  icon: typeof HomeIcon;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex-1 flex flex-col items-center gap-0.5 justify-center outline-none",
          isActive ? "text-primary" : "text-ink-muted-48",
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={24} strokeWidth={isActive ? 2.1 : 1.8} />
          <span className="text-[11px] leading-none">{label}</span>
        </>
      )}
    </NavLink>
  );
}
