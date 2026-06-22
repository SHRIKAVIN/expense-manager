import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { pressProps, usePrefersReducedMotion } from "@/lib/motion";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** When set, the card becomes tappable and gets the system press-scale. */
  onPress?: () => void;
  children?: ReactNode;
  padded?: boolean;
}

/** Flat card: rounded-lg, 1px hairline border, NO shadow (§1.3). */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { onPress, className, children, padded = true, ...rest },
  ref,
) {
  const reduced = usePrefersReducedMotion();
  const baseClass = cn(
    "rounded-lg border border-hairline bg-canvas",
    padded && "p-6",
    onPress && "cursor-pointer text-left w-full",
    className,
  );

  if (onPress) {
    return (
      <motion.button
        ref={ref as never}
        type="button"
        onClick={onPress}
        whileTap={reduced ? undefined : pressProps.whileTap}
        transition={pressProps.transition}
        className={cn(baseClass, "outline-none")}
      >
        {children}
      </motion.button>
    );
  }

  return (
    <div ref={ref} className={baseClass} {...rest}>
      {children}
    </div>
  );
});
