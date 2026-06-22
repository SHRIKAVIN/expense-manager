import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { CloseIcon } from "@/lib/icons";
import { usePrefersReducedMotion } from "@/lib/motion";

interface LightboxProps {
  src: string | null;
  onClose: () => void;
}

/** Full-screen receipt view with a circular translucent close button (44x44). */
export function Lightbox({ src, onClose }: LightboxProps) {
  const reduced = usePrefersReducedMotion();
  return createPortal(
    <AnimatePresence>
      {src && (
        <motion.div
          className="fixed inset-0 z-[70] bg-surface-black/90 flex items-center justify-center p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.2 }}
          onClick={onClose}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute top-6 right-6 h-11 w-11 rounded-full bg-chip-translucent backdrop-blur flex items-center justify-center text-ink outline-none"
          >
            <CloseIcon size={22} />
          </button>
          <motion.img
            src={src}
            alt="Receipt"
            className="max-h-full max-w-full rounded-sm object-contain"
            initial={reduced ? false : { scale: 0.96 }}
            animate={{ scale: 1 }}
            onClick={(e) => e.stopPropagation()}
          />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
