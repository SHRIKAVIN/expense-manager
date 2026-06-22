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
       * Pin the shell to the visual viewport with `fixed inset-0` rather than a
       * height-based box. On iOS standalone PWAs the height APIs (100dvh / 100vh
       * / innerHeight) oscillate after backgrounding, which floats a
       * `fixed; bottom:0` bar off the true screen edge. A fixed inset-0 box
       * anchors to both real edges, so the bottom bar stays put across relaunches.
       */}
      <div className="fixed inset-0 bg-canvas text-ink flex flex-col lg:flex-row">
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

        {/* Content column: scrolls internally; `relative` anchors the nav + FAB. */}
        <div className="relative flex-1 min-w-0 h-full">
          <main
            ref={scrollRef}
            onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 6)}
            className={cn(
              "h-full overflow-y-auto overflow-x-hidden lg:pb-12",
              // Reserve room below the content so the floating FAB never sits on
              // top of the last row — it rests over empty space instead.
              showFab
                ? "pb-[calc(env(safe-area-inset-bottom)+9.5rem)]"
                : "pb-[calc(env(safe-area-inset-bottom)+4.5rem)]",
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

          {/* Bottom tab bar (mobile) — absolute within the pinned shell = true bottom. */}
          <nav className="lg:hidden absolute bottom-0 inset-x-0 z-40 border-t border-hairline glass pb-[max(calc(env(safe-area-inset-bottom)_-_0.625rem),0.375rem)]">
            <div className="flex items-stretch justify-around">
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
          "flex-1 flex flex-col items-center gap-0.5 pt-2 pb-1 outline-none",
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
