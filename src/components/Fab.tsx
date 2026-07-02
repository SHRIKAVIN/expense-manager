import { motion } from "framer-motion";
import { pressProps, usePrefersReducedMotion } from "@/lib/motion";

interface FabProps {
  onClick: () => void;
  label?: string;
  "data-testid"?: string;
}

function PlusIcon3D({ size = 26 }: { size?: number }) {
  const stroke = 2.75;
  const d = "M12 5v14M5 12h14";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="relative z-[1]">
      <g strokeLinecap="round" fill="none">
        <g stroke="rgba(0,0,0,0.34)" strokeWidth={stroke} transform="translate(0 0.85)">
          <path d={d} />
        </g>
        <g stroke="rgba(255,255,255,0.42)" strokeWidth={stroke} transform="translate(0 -0.45)">
          <path d={d} />
        </g>
        <g stroke="#ffffff" strokeWidth={stroke}>
          <path d={d} />
        </g>
      </g>
    </svg>
  );
}

/** Floating add button — 3D elevated tile with embossed plus (expense / income). */
export function Fab({
  onClick,
  label = "Add expense",
  "data-testid": testId = "fab-add-expense",
}: FabProps) {
  const reduced = usePrefersReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={label}
      data-testid={testId}
      whileTap={reduced ? undefined : pressProps.whileTap}
      transition={pressProps.transition}
      className="fab-3d absolute z-40 right-5 bottom-[var(--fab-bottom-offset)] lg:bottom-8 lg:right-8 flex h-14 w-14 items-center justify-center rounded-full text-on-primary outline-none"
    >
      <PlusIcon3D size={26} />
    </motion.button>
  );
}
