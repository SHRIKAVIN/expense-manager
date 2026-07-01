import { motion } from "framer-motion";
import { pressProps, usePrefersReducedMotion } from "@/lib/motion";
import { PlusIcon } from "@/lib/icons";

interface FabProps {
  onClick: () => void;
  label?: string;
}

/**
 * Floating Add-Expense FAB: 56px circular, Action Blue, the single drop-shadow (§1.3).
 */
export function Fab({ onClick, label = "Add expense" }: FabProps) {
  const reduced = usePrefersReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={label}
      whileTap={reduced ? undefined : pressProps.whileTap}
      transition={pressProps.transition}
      className="absolute z-40 right-5 bottom-[var(--fab-bottom-offset)] lg:bottom-8 lg:right-8 h-14 w-14 rounded-full bg-primary text-on-primary shadow-product flex items-center justify-center outline-none"
    >
      <PlusIcon size={26} />
    </motion.button>
  );
}
