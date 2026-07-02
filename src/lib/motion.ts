import { useEffect, useState } from "react";
import type { Transition, Variants } from "framer-motion";

/** Live subscription to the user's reduced-motion preference. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

/** The one system-wide micro-interaction: press scales to 0.95 (§6). */
export const pressProps = {
  whileTap: { scale: 0.95 },
  transition: { type: "spring", stiffness: 600, damping: 30, mass: 0.5 } as Transition,
};

export const sheetSpring: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 30,
};

export const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 0.4 },
};

export const sheetVariants: Variants = {
  hidden: {
    y: "100%",
    transition: sheetSpring,
  },
  visible: {
    y: 0,
    transition: sheetSpring,
  },
};

export const modalVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.96,
    transition: { duration: 0.18, ease: "easeOut" },
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.18, ease: "easeOut" },
  },
};

/** List item enter: fade + slight upward slide, staggered. */
export const listItemVariants: Variants = {
  hidden: { opacity: 0, y: -8 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, height: 0, marginTop: 0, marginBottom: 0 },
};

export const pageVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

export const pageTransition: Transition = { duration: 0.18, ease: "easeOut" };
