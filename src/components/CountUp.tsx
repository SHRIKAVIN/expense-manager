import { useEffect, useState } from "react";
import { useSpring } from "framer-motion";
import { usePrefersReducedMotion } from "@/lib/motion";
import { formatCurrency } from "@/lib/format";

interface CountUpProps {
  value: number;
  currency?: string;
  className?: string;
}

/** Animates the displayed figure from its previous value to the new one (~400ms). */
export function CountUp({ value, currency, className }: CountUpProps) {
  const reduced = usePrefersReducedMotion();
  const spring = useSpring(value, { stiffness: 90, damping: 20, mass: 0.6 });
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      return;
    }
    spring.set(value);
    const unsub = spring.on("change", (v) => setDisplay(v));
    return () => unsub();
  }, [value, spring, reduced]);

  return <span className={className}>{formatCurrency(reduced ? value : display, currency)}</span>;
}
