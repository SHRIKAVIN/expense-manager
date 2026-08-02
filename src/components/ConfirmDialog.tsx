import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { Button } from "./Button";
import {
  backdropSmooth,
  modalSmooth,
  usePrefersReducedMotion,
} from "@/lib/motion";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Centered confirmation alert. Per the design system the destructive action
 * stays Action Blue — intent is carried by copy, not a second colour.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const fade = reduced ? { duration: 0 } : backdropSmooth;
  const panel = reduced ? { duration: 0 } : modalSmooth;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="confirm-dialog"
          className="fixed inset-0 z-[55] flex items-center justify-center p-6"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 1 }}
        >
          <motion.div
            className="absolute inset-0 bg-surface-black"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            transition={fade}
            onClick={onClose}
          />
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-label={title}
            className="relative w-full max-w-sm bg-canvas border border-hairline rounded-lg p-6 will-change-transform"
            initial={{ opacity: 0, scale: 0.98, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 16 }}
            transition={panel}
          >
            <h2 className="text-tagline text-ink mb-2">{title}</h2>
            {message && <p className="text-body text-ink-muted-48 mb-6">{message}</p>}
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={onClose}>
                {cancelLabel}
              </Button>
              <Button variant="primary" onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
