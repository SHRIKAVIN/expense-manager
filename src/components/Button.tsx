import { forwardRef, type ReactNode } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/cn";
import { pressProps, usePrefersReducedMotion } from "@/lib/motion";

type Variant = "primary" | "secondary" | "icon-circular";

interface ButtonProps extends Omit<HTMLMotionProps<"button">, "ref"> {
  variant?: Variant;
  fullWidth?: boolean;
  children?: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "rounded-pill bg-primary text-on-primary text-body-strong px-6 py-3 inline-flex items-center justify-center gap-2",
  secondary:
    "rounded-pill bg-transparent border border-primary text-primary text-body-strong px-6 py-3 inline-flex items-center justify-center gap-2",
  "icon-circular":
    "rounded-full bg-chip-translucent text-ink w-11 h-11 inline-flex items-center justify-center backdrop-blur",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", fullWidth, className, children, disabled, ...rest },
  ref,
) {
  const reduced = usePrefersReducedMotion();
  return (
    <motion.button
      ref={ref}
      type="button"
      disabled={disabled}
      whileTap={reduced || disabled ? undefined : pressProps.whileTap}
      transition={pressProps.transition}
      className={cn(
        "select-none outline-none disabled:opacity-40 disabled:cursor-not-allowed",
        variantClasses[variant],
        fullWidth && "w-full",
        className,
      )}
      {...rest}
    >
      {children}
    </motion.button>
  );
});
