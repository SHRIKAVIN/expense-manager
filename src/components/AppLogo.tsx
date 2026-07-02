import { AppLogoMark } from "@/components/AppLogoMark";
import { cn } from "@/lib/cn";

interface AppLogoProps {
  size?: number;
  className?: string;
}

export function AppLogo({ size = 36, className }: AppLogoProps) {
  return (
    <span className={cn("inline-flex shrink-0", className)} role="img" aria-label="Expense Manager">
      <AppLogoMark size={size} />
    </span>
  );
}
