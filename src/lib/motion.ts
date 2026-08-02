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

/** Softer liquid morph for nav active pills. */
export const liquidSpring: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 34,
  mass: 0.7,
};

/** Soft sheet slide — longer settle, little overshoot (open & close). */
export const sheetSpring: Transition = {
  type: "spring",
  stiffness: 280,
  damping: 34,
  mass: 0.95,
  restDelta: 0.001,
  restSpeed: 0.001,
};

/** Extra-smooth sheet tween (preferred for full-height bottom sheets). */
export const sheetSmooth: Transition = {
  type: "tween",
  duration: 0.45,
  ease: [0.32, 0.72, 0, 1],
};

/** Shared overlay curve for sheets, dialogs, lightbox, success. */
export const overlayEase = [0.32, 0.72, 0, 1] as const;

export const backdropSmooth: Transition = {
  type: "tween",
  duration: 0.4,
  ease: overlayEase,
};

export const modalSmooth: Transition = {
  type: "tween",
  duration: 0.36,
  ease: overlayEase,
};

/** Springy zoom used when a surface grows out of the control that opened it. */
export const zoomSpring: Transition = {
  type: "spring",
  stiffness: 380,
  damping: 36,
  mass: 0.85,
  restDelta: 0.001,
};

export const backdropVariants: Variants = {
  hidden: { opacity: 0, transition: backdropSmooth },
  visible: { opacity: 0.4, transition: backdropSmooth },
};

export const sheetVariants: Variants = {
  hidden: {
    y: "100%",
    transition: sheetSmooth,
  },
  visible: {
    y: 0,
    transition: sheetSmooth,
  },
};

export const modalVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.98,
    y: 12,
    transition: modalSmooth,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: modalSmooth,
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
