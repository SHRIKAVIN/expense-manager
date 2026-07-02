import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { CloseIcon } from "@/lib/icons";
import { backdropVariants, usePrefersReducedMotion } from "@/lib/motion";

interface LightboxProps {
  src: string | null;
  onClose: () => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function touchDistance(touches: React.TouchList | TouchList) {
  const a = touches[0];
  const b = touches[1];
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

function ZoomableImage({ src }: { src: string }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [{ scale, x, y }, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const transformRef = useRef({ scale: 1, x: 0, y: 0 });
  const pinchRef = useRef<{ distance: number; scale: number } | null>(null);
  const panRef = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null);
  const lastTapRef = useRef(0);

  const applyTransform = useCallback((next: { scale: number; x: number; y: number }) => {
    const clamped = {
      scale: clamp(next.scale, MIN_SCALE, MAX_SCALE),
      x: next.scale <= 1 ? 0 : next.x,
      y: next.scale <= 1 ? 0 : next.y,
    };
    transformRef.current = clamped;
    setTransform(clamped);
  }, []);

  useEffect(() => {
    applyTransform({ scale: 1, x: 0, y: 0 });
  }, [src, applyTransform]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? -0.12 : 0.12;
      const current = transformRef.current;
      applyTransform({ ...current, scale: current.scale * (1 + delta) });
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [applyTransform]);

  const toggleZoom = () => {
    const current = transformRef.current;
    if (current.scale > 1.05) {
      applyTransform({ scale: 1, x: 0, y: 0 });
      return;
    }
    applyTransform({ scale: 2.5, x: 0, y: 0 });
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleZoom();
  };

  const onTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (e.touches.length === 2) {
      pinchRef.current = {
        distance: touchDistance(e.touches),
        scale: transformRef.current.scale,
      };
      panRef.current = null;
      return;
    }

    if (e.touches.length === 1 && transformRef.current.scale > 1) {
      panRef.current = {
        x: transformRef.current.x,
        y: transformRef.current.y,
        originX: e.touches[0].clientX,
        originY: e.touches[0].clientY,
      };
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (e.touches.length === 2 && pinchRef.current) {
      const nextScale =
        pinchRef.current.scale * (touchDistance(e.touches) / pinchRef.current.distance);
      applyTransform({ ...transformRef.current, scale: nextScale });
      return;
    }

    if (e.touches.length === 1 && panRef.current && transformRef.current.scale > 1) {
      const dx = e.touches[0].clientX - panRef.current.originX;
      const dy = e.touches[0].clientY - panRef.current.originY;
      applyTransform({
        ...transformRef.current,
        x: panRef.current.x + dx,
        y: panRef.current.y + dy,
      });
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (e.touches.length < 2) pinchRef.current = null;
    if (e.touches.length === 0) panRef.current = null;

    if (e.changedTouches.length === 1 && e.touches.length === 0) {
      const now = Date.now();
      if (now - lastTapRef.current < 280) {
        toggleZoom();
        lastTapRef.current = 0;
      } else {
        lastTapRef.current = now;
      }
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (transformRef.current.scale <= 1 || e.pointerType === "touch") return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    panRef.current = {
      x: transformRef.current.x,
      y: transformRef.current.y,
      originX: e.clientX,
      originY: e.clientY,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!panRef.current || e.pointerType === "touch") return;
    e.stopPropagation();
    const dx = e.clientX - panRef.current.originX;
    const dy = e.clientY - panRef.current.originY;
    applyTransform({
      ...transformRef.current,
      x: panRef.current.x + dx,
      y: panRef.current.y + dy,
    });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (e.pointerType === "touch") return;
    panRef.current = null;
  };

  return (
    <div
      ref={viewportRef}
      className="relative z-10 flex h-full w-full items-center justify-center overflow-hidden touch-none"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onClick={(e) => e.stopPropagation()}
    >
      <img
        src={src}
        alt="Receipt"
        draggable={false}
        onDoubleClick={onDoubleClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="max-h-[min(58dvh,520px)] max-w-[min(92vw,520px)] select-none rounded-sm object-contain shadow-product"
        style={{
          transform: `translate(${x}px, ${y}px) scale(${scale})`,
          cursor: scale > 1 ? "grab" : "zoom-in",
        }}
      />
      {scale > 1.05 && (
        <p className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-chip-translucent px-3 py-1 text-fine-print text-ink backdrop-blur">
          Drag to pan · double-tap to reset
        </p>
      )}
    </div>
  );
}

/** Full-screen receipt view with pinch / double-tap zoom and pan. */
export function Lightbox({ src, onClose }: LightboxProps) {
  const reduced = usePrefersReducedMotion();
  return createPortal(
    <AnimatePresence>
      {src && (
        <motion.div
          className="fixed inset-0 z-[70] flex flex-col items-center justify-end pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-14 px-4 sm:justify-center sm:pb-6 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.2 }}
        >
          <motion.div
            className="absolute inset-0 bg-surface-black backdrop-blur-[2px]"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: reduced ? 0 : 0.2 }}
            onClick={onClose}
          />
          <div className="relative z-10 flex w-full max-w-lg flex-1 min-h-0 flex-col items-center justify-center sm:max-h-[72dvh]">
            <div className="relative h-full w-full max-h-[58dvh] sm:max-h-[65dvh]">
              <ZoomableImage src={src} />
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="relative z-20 mt-4 h-12 min-w-[7.5rem] rounded-pill bg-chip-translucent px-6 backdrop-blur flex items-center justify-center gap-2 text-body-strong text-ink outline-none sm:absolute sm:bottom-6 sm:right-6 sm:mt-0 sm:h-11 sm:min-w-0 sm:w-11 sm:rounded-full sm:px-0"
          >
            <CloseIcon size={22} />
            <span className="sm:hidden">Close</span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
