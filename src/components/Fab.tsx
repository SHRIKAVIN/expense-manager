import { useEffect } from "react";
import { motion } from "framer-motion";
import { useLottie } from "lottie-react";
import { pressProps, usePrefersReducedMotion } from "@/lib/motion";
import fabAddAnimation from "@/assets/lottie/fab-add.json";

interface FabProps {
  onClick: () => void;
  label?: string;
  "data-testid"?: string;
}

function FabAddLottie({ size = 56 }: { size?: number }) {
  const { View, animationItem } = useLottie(
    {
      animationData: fabAddAnimation,
      loop: true,
      autoplay: true,
      rendererSettings: { preserveAspectRatio: "xMidYMid meet" },
    },
    { width: size, height: size },
  );

  useEffect(() => {
    animationItem?.setSpeed(0.65);
  }, [animationItem]);

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {View}
    </span>
  );
}

/** Floating add button — animated Lottie plus (expense / income). */
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
      className="absolute z-40 right-4 bottom-24 lg:bottom-8 lg:right-8 flex h-20 w-20 items-center justify-center rounded-full outline-none"
    >
      <FabAddLottie size={80} />
    </motion.button>
  );
}
