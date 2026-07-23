import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { useLottie } from "lottie-react";
import { usePrefersReducedMotion } from "@/lib/motion";
import successAnimation from "@/assets/lottie/success.json";
import deleteAnimation from "@/assets/lottie/delete-success.json";
import reimbursementPaidAnimation from "@/assets/lottie/reimbursement-paid.json";
import reimbursementReceivedAnimation from "@/assets/lottie/reimbursement-received.json";

export type SuccessOverlayVariant =
  | "added"
  | "deleted"
  | "reimbursement_paid"
  | "reimbursement_received";

interface SuccessOverlayProps {
  open: boolean;
  /** Large headline amount, already formatted. */
  amountLabel: string;
  title?: string;
  detail?: string;
  variant?: SuccessOverlayVariant;
  onClose: () => void;
}

const AUTO_DISMISS_MS = 2200;
const REDUCED_DISMISS_MS = 900;
const LOTTIE_SIZE = 220;

const VARIANT = {
  added: {
    animation: successAnimation,
    defaultTitle: "Expense added",
    accent: "var(--color-primary)",
    testId: "expense-success-overlay",
    dismissMs: AUTO_DISMISS_MS,
    lottieSize: LOTTIE_SIZE,
  },
  deleted: {
    animation: deleteAnimation,
    defaultTitle: "Expense deleted",
    accent: "#ff3c00",
    testId: "expense-delete-overlay",
    dismissMs: AUTO_DISMISS_MS,
    lottieSize: LOTTIE_SIZE,
  },
  /** Sylvia/Kavin marks a reimbursement paid (thank-you bow). */
  reimbursement_paid: {
    animation: reimbursementPaidAnimation,
    defaultTitle: "Marked paid",
    accent: "#3e8257",
    testId: "reimbursement-paid-overlay",
    dismissMs: 2600,
    lottieSize: 260,
  },
  /** Requester confirms they received the money (coin rain). */
  reimbursement_received: {
    animation: reimbursementReceivedAnimation,
    defaultTitle: "Money received",
    accent: "#f5a623",
    testId: "reimbursement-received-overlay",
    dismissMs: 3200,
    lottieSize: 260,
  },
} as const;

/** Offsets from the Lottie center (px). */
const PARTICLES = [
  { x: -96, y: 48, size: 6, delay: 0.05, duration: 2.4 },
  { x: -72, y: -58, size: 4, delay: 0.18, duration: 2.1 },
  { x: 88, y: 42, size: 7, delay: 0.1, duration: 2.6 },
  { x: 74, y: -64, size: 5, delay: 0.28, duration: 2.2 },
  { x: -48, y: 78, size: 5, delay: 0.35, duration: 2.5 },
  { x: 52, y: 82, size: 4, delay: 0.22, duration: 2.3 },
  { x: -110, y: 8, size: 3, delay: 0.42, duration: 2.0 },
  { x: 108, y: -12, size: 6, delay: 0.15, duration: 2.7 },
  { x: -28, y: -88, size: 4, delay: 0.3, duration: 2.15 },
  { x: 32, y: -92, size: 5, delay: 0.08, duration: 2.45 },
] as const;

function SuccessLottie({
  size,
  animationData,
}: {
  size: number;
  animationData: object;
}) {
  const { View, animationItem } = useLottie(
    {
      animationData,
      loop: false,
      autoplay: true,
      rendererSettings: { preserveAspectRatio: "xMidYMid meet" },
    },
    { width: size, height: size },
  );

  useEffect(() => {
    animationItem?.setSpeed(0.9);
  }, [animationItem]);

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {View}
    </span>
  );
}

/** Rings, wash, and particles anchored to the Lottie center. */
function SuccessIconEffects({
  reduced,
  accent,
}: {
  reduced: boolean;
  accent: string;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
      <motion.div
        className="absolute size-[min(92vw,28rem)] rounded-full"
        style={{
          background: `radial-gradient(circle at center, color-mix(in srgb, ${accent} 28%, transparent), transparent 68%)`,
        }}
        initial={reduced ? false : { opacity: 0, scale: 0.85 }}
        animate={{ opacity: reduced ? 1 : [0.5, 1, 0.72], scale: 1 }}
        transition={
          reduced
            ? { duration: 0 }
            : { duration: 2.2, times: [0, 0.45, 1], ease: "easeOut" }
        }
      />

      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{ border: `1px solid color-mix(in srgb, ${accent} 30%, transparent)` }}
          initial={
            reduced
              ? { width: 180 + i * 70, height: 180 + i * 70, opacity: 0.18 - i * 0.04 }
              : { width: 120, height: 120, opacity: 0.45 }
          }
          animate={
            reduced
              ? undefined
              : {
                  width: 220 + i * 110,
                  height: 220 + i * 110,
                  opacity: 0,
                }
          }
          transition={
            reduced
              ? undefined
              : {
                  duration: 1.6 + i * 0.25,
                  delay: 0.12 + i * 0.18,
                  ease: "easeOut",
                }
          }
        />
      ))}

      {!reduced &&
        PARTICLES.map((p, i) => (
          <motion.span
            key={i}
            className="absolute left-1/2 top-1/2 rounded-full"
            style={{
              width: p.size,
              height: p.size,
              marginLeft: p.x - p.size / 2,
              marginTop: p.y - p.size / 2,
              background: `color-mix(in srgb, ${accent} 55%, transparent)`,
            }}
            initial={{ opacity: 0, y: 12, scale: 0.6 }}
            animate={{
              opacity: [0, 0.85, 0],
              y: [12, -48 - (i % 4) * 10],
              scale: [0.6, 1, 0.85],
              x: [0, (i % 2 === 0 ? 1 : -1) * (8 + (i % 3) * 4)],
            }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              ease: "easeOut",
            }}
          />
        ))}
    </div>
  );
}

/**
 * Full-screen success celebration (payment-app style) after a completed action.
 * Tap or wait for auto-dismiss.
 */
export function SuccessOverlay({
  open,
  amountLabel,
  title,
  detail,
  variant = "added",
  onClose,
}: SuccessOverlayProps) {
  const reduced = usePrefersReducedMotion();
  const config = VARIANT[variant];
  const resolvedTitle = title ?? config.defaultTitle;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(
      onClose,
      reduced ? REDUCED_DISMISS_MS : config.dismissMs,
    );
    return () => window.clearTimeout(id);
  }, [open, onClose, reduced, config.dismissMs]);

  const size = config.lottieSize;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.button
          type="button"
          key={`success-overlay-${variant}`}
          aria-label={`${resolvedTitle}. ${amountLabel}`}
          data-testid={config.testId}
          onClick={onClose}
          className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-5 overflow-hidden bg-canvas px-6 outline-none"
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.22 }}
        >
          <motion.div
            className="relative z-10 flex items-center justify-center"
            style={{ width: size, height: size }}
            initial={reduced ? false : { scale: 0.86, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: reduced ? 0 : 0.28, ease: "easeOut" }}
          >
            <SuccessIconEffects reduced={reduced} accent={config.accent} />
            <div className="relative z-10">
              <SuccessLottie size={size} animationData={config.animation} />
            </div>
          </motion.div>
          <motion.div
            className="relative z-10 flex flex-col items-center gap-1.5 text-center"
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0 : 0.28, delay: reduced ? 0 : 0.35, ease: "easeOut" }}
          >
            <p className="text-[2.5rem] font-bold tabular-nums leading-none tracking-tight text-ink sm:text-[3rem]">
              {amountLabel}
            </p>
            <p className="text-tagline text-ink">{resolvedTitle}</p>
            {detail ? <p className="text-body text-ink-muted-80 max-w-xs">{detail}</p> : null}
          </motion.div>
        </motion.button>
      )}
    </AnimatePresence>,
    document.body,
  );
}
