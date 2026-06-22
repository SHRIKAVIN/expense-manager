import { type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useScrolled } from "./scroll";

export function Screen({
  children,
  className,
  /** Adds top safe-area padding. Disable when a sticky ScreenHeader owns the top. */
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
        topInset && "pt-[calc(env(safe-area-inset-top)+1.25rem)] lg:pt-12",
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
        // Full-bleed within the Screen padding so the blur spans edge-to-edge.
        "sticky top-0 z-30 -mx-5 px-5 lg:-mx-8 lg:px-8 mb-6 border-b transition-colors duration-200",
        // Clear the notch when stuck to the top; desktop has no inset.
        "pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3 lg:pt-10",
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
