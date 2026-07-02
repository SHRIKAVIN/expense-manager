import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { pressProps, usePrefersReducedMotion } from "@/lib/motion";

interface ChipProps {
  selected?: boolean;
  onClick?: () => void;
  children: ReactNode;
  leftIcon?: ReactNode;
  className?: string;
  "data-testid"?: string;
}

/** Pill-shaped selectable chip. Selected = 2px primary-focus border (no color swap). */
export function Chip({
  selected,
  onClick,
  children,
  leftIcon,
  className,
  "data-testid": testId,
}: ChipProps) {
  const reduced = usePrefersReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={reduced ? undefined : pressProps.whileTap}
      transition={pressProps.transition}
      aria-pressed={selected}
      data-testid={testId}
      className={cn(
        "shrink-0 inline-flex items-center gap-1.5 rounded-pill px-4 py-2 outline-none whitespace-nowrap bg-canvas",
        selected
          ? "border-2 border-primary-focus text-ink text-caption-strong"
          : "border border-hairline text-ink text-caption",
        className,
      )}
    >
      {leftIcon}
      {children}
    </motion.button>
  );
}
