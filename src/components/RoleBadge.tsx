import type { Role } from "@/lib/types";
import { cn } from "@/lib/cn";

export function RoleBadge({ role, className }: { role: Role; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill border border-hairline px-3 py-1 text-caption text-ink-muted-80",
        className,
      )}
    >
      {role}
    </span>
  );
}
