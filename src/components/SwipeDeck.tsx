import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { animate, motion, useMotionValue, type PanInfo } from "framer-motion";
import { cn } from "@/lib/cn";
import { usePrefersReducedMotion } from "@/lib/motion";

const SETTLE = { type: "spring", stiffness: 420, damping: 42, mass: 0.9 } as const;

interface SwipeDeckProps<T> {
  items: T[];
  getKey: (item: T) => string;
  children: (item: T, index: number) => ReactNode;
  className?: string;
  label?: string;
}

/** One card at a time; drag left/right (or tap a dot) to reach the next one. */
export function SwipeDeck<T>({ items, getKey, children, className, label }: SwipeDeckProps<T>) {
  const reduced = usePrefersReducedMotion();
  const viewportRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const x = useMotionValue(0);

  const count = items.length;
  const safeIndex = Math.min(index, Math.max(count - 1, 0));

  useEffect(() => {
    if (index !== safeIndex) setIndex(safeIndex);
  }, [index, safeIndex]);

  useLayoutEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    const measure = () => setWidth(node.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const slideTo = (next: number, immediate = false) => {
    const target = -next * width;
    if (immediate || reduced) {
      x.set(target);
      return;
    }
    void animate(x, target, SETTLE);
  };

  useEffect(() => {
    slideTo(safeIndex, true);
    // Snap without animation when the viewport resizes or the list changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, count]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (!width) return;
    const projected = info.offset.x + info.velocity.x * 0.15;
    let next = safeIndex;
    if (projected < -width * 0.22) next = Math.min(safeIndex + 1, count - 1);
    else if (projected > width * 0.22) next = Math.max(safeIndex - 1, 0);
    setIndex(next);
    slideTo(next);
  };

  if (count === 0) return null;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div ref={viewportRef} className="overflow-hidden">
        <motion.div
          className="flex items-stretch"
          style={{ x }}
          drag={count > 1 ? "x" : false}
          dragElastic={0.12}
          dragMomentum={false}
          dragConstraints={{ left: -(count - 1) * width, right: 0 }}
          onDragEnd={handleDragEnd}
          role="group"
          aria-label={label}
        >
          {items.map((item, i) => (
            <div
              key={getKey(item)}
              className="w-full shrink-0"
              aria-hidden={i !== safeIndex}
              style={{ pointerEvents: i === safeIndex ? "auto" : "none" }}
            >
              {children(item, i)}
            </div>
          ))}
        </motion.div>
      </div>

      {count > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          {items.map((item, i) => (
            <button
              key={getKey(item)}
              type="button"
              aria-label={`Show item ${i + 1} of ${count}`}
              aria-current={i === safeIndex}
              className={cn(
                "h-1.5 rounded-full transition-all duration-200",
                i === safeIndex ? "w-5 bg-primary" : "w-1.5 bg-hairline",
              )}
              onClick={() => {
                setIndex(i);
                slideTo(i);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
