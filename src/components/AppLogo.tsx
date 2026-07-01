import { cn } from "@/lib/cn";

interface AppLogoProps {
  size?: number;
  className?: string;
}

export function AppLogo({ size = 36, className }: AppLogoProps) {
  return (
    <img
      src="/favicon.svg"
      alt="Expense Manager"
      width={size}
      height={size}
      className={cn("rounded-sm shrink-0", className)}
    />
  );
}
