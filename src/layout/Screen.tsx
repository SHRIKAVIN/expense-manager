import { type ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Screen({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-2xl px-5 lg:px-8",
        // Clear the status bar / notch in standalone PWA, then add breathing room.
        "pt-[calc(env(safe-area-inset-top)+1.25rem)] lg:pt-12",
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
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-display-md text-ink">{title}</h1>
        {subtitle && <p className="text-body text-ink-muted-48 mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
