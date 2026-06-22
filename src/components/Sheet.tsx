import { useEffect, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import {
  backdropVariants,
  modalVariants,
  sheetSpring,
  sheetVariants,
  usePrefersReducedMotion,
} from "@/lib/motion";
import { useIsDesktop } from "@/lib/useMediaQuery";
import { Button } from "./Button";
import { CloseIcon } from "@/lib/icons";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Optional sticky footer (e.g., primary action). */
  footer?: ReactNode;
}

/**
 * Bottom sheet on mobile (slide up, spring), centered fade+scale modal on desktop.
 */
export function Sheet({ open, onClose, title, children, footer }: SheetProps) {
  const isDesktop = useIsDesktop();
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const content = (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center">
          <motion.div
            className="absolute inset-0 bg-surface-black"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: reduced ? 0 : 0.2 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="relative w-full lg:max-w-lg bg-canvas border border-hairline rounded-t-lg lg:rounded-lg max-h-[92vh] flex flex-col"
            variants={isDesktop ? modalVariants : sheetVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={reduced ? { duration: 0 } : isDesktop ? { duration: 0.18 } : sheetSpring}
          >
            <div className="flex items-center justify-between px-6 pt-6 pb-3 shrink-0">
              <h2 className="text-tagline text-ink">{title}</h2>
              <Button variant="icon-circular" onClick={onClose} aria-label="Close">
                <CloseIcon size={20} />
              </Button>
            </div>
            <div className="overflow-y-auto px-6 pb-6 flex-1">{children}</div>
            {footer && (
              <div className="px-6 py-4 border-t border-hairline shrink-0">{footer}</div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}
