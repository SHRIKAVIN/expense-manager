import { type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useScrolled } from "./scroll";

export function Screen({
  children,
  className,
  topInset = true,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  topInset?: boolean;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-2xl px-5 lg:px-8",
        topInset ? "pt-6 lg:pt-12" : "pt-6 lg:pt-0",
        className,
      )}
      {...rest}
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
        "pt-4 pb-4 lg:pt-10",
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
