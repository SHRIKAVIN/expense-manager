import { type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useScrolled } from "./scroll";

export function Screen({
  children,
  className,
  /** Adds top padding. Safe-area top is owned by AppHeader on mobile. */
  topInset = true,
}: {
  children: ReactNode;
  className?: string;
  topInset?: boolean;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-2xl px-5 lg:px-8",
        topInset && "pt-5 lg:pt-12",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  const scrolled = useScrolled();
  return (
    <div
      className={cn(
        // Mobile title lives in AppHeader; keep this for desktop where the rail has no title.
        "hidden lg:block",
        "sticky top-0 z-30 -mx-5 px-5 lg:-mx-8 lg:px-8 mb-6 border-b transition-colors duration-200",
        "pt-3 pb-3 lg:pt-10",
        scrolled ? "glass border-hairline" : "border-transparent",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-display-md text-ink">{title}</h1>
          {subtitle && <p className="text-body text-ink-muted-48 mt-1">{subtitle}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}
