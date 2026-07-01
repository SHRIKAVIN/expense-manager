import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { usePrefersReducedMotion } from "@/lib/motion";

interface ToastItem {
  id: number;
  message: string;
}

interface ToastContextValue {
  show: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DISMISS_DISTANCE = 44;
const DISMISS_VELOCITY = 320;

function shouldDismissToast(offset: { x: number; y: number }, velocity: { x: number; y: number }) {
  return (
    Math.hypot(offset.x, offset.y) > DISMISS_DISTANCE ||
    Math.hypot(velocity.x, velocity.y) > DISMISS_VELOCITY
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const reduced = usePrefersReducedMotion();

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const show = useCallback(
    (message: string) => {
      const id = ++idRef.current;
      setToasts((t) => [...t, { id, message }]);
      window.setTimeout(() => dismiss(id), 2600);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="fixed inset-x-0 bottom-6 z-[60] flex flex-col items-center gap-2 px-4 pointer-events-none">
          <AnimatePresence>
            {toasts.map((t) => (
              <motion.div
                key={t.id}
                layout
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                drag={reduced ? false : true}
                dragElastic={0.55}
                onDragEnd={(_, info) => {
                  if (shouldDismissToast(info.offset, info.velocity)) dismiss(t.id);
                }}
                className="pointer-events-auto rounded-lg border border-hairline bg-canvas-parchment px-4 py-3 text-body text-ink min-w-[220px] text-center cursor-grab active:cursor-grabbing"
              >
                {t.message}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
