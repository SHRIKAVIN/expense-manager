import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { sheetSmooth, backdropSmooth, modalSmooth, usePrefersReducedMotion } from "@/lib/motion";
import { useIsDesktop } from "@/lib/useMediaQuery";
import { useVisualViewportOverlay } from "@/lib/useVisualViewportOverlay";
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
 * Bottom sheet on mobile — mirrored smooth slide up/down.
 * Centered fade+scale modal on desktop.
 * On iOS the overlay is pinned to the visual viewport so the sheet stays at the
 * true bottom when the software keyboard opens.
 */
export function Sheet({ open, onClose, title, children, footer }: SheetProps) {
  const isDesktop = useIsDesktop();
  const reduced = usePrefersReducedMotion();
  const overlayRef = useRef<HTMLDivElement>(null);
  /** Keep viewport pinning until the exit animation finishes. */
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  useVisualViewportOverlay(overlayRef, mounted && !isDesktop);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const panelTransition = reduced
    ? { duration: 0 }
    : isDesktop
      ? modalSmooth
      : sheetSmooth;

  const backdropTransition = reduced ? { duration: 0 } : backdropSmooth;

  const content = (
    <AnimatePresence onExitComplete={() => setMounted(false)}>
      {open && (
        <motion.div
          key="sheet-root"
          ref={overlayRef}
          className="fixed z-50 inset-0 flex flex-col justify-end lg:items-center lg:justify-center"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 1 }}
        >
          <motion.div
            className="absolute inset-0 bg-surface-black"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            transition={backdropTransition}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            data-testid="sheet-panel"
            className="relative w-full lg:max-w-lg bg-canvas border border-hairline rounded-t-lg lg:rounded-lg max-h-[min(92dvh,100%)] flex flex-col shrink-0 will-change-transform"
            initial={
              isDesktop
                ? { opacity: 0, scale: 0.98, y: 16 }
                : { y: "100%" }
            }
            animate={
              isDesktop
                ? { opacity: 1, scale: 1, y: 0 }
                : { y: 0 }
            }
            exit={
              isDesktop
                ? { opacity: 0, scale: 0.98, y: 16 }
                : { y: "100%" }
            }
            transition={panelTransition}
          >
            <div className="flex items-center justify-between px-6 pt-6 pb-3 shrink-0">
              <h2 className="text-tagline text-ink">{title}</h2>
              <Button
                variant="icon-circular"
                onClick={onClose}
                aria-label="Close"
                data-testid="sheet-close"
              >
                <CloseIcon size={20} />
              </Button>
            </div>
            <div className="overflow-y-auto overscroll-contain scroll-smooth px-6 pb-6 flex-1 min-h-0 [&:last-child]:pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
              {children}
            </div>
            {footer && (
              <div className="px-6 pt-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] border-t border-hairline shrink-0 lg:pb-4">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}
